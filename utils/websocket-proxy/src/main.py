"""WebSocket proxy for the Google Customer Engagement Suite (CES) API.

This script implements a WebSocket proxy server that securely forwards requests
from a client-side application (like the ces-messenger web widget) to the
Google CES Bidirectional Streaming API. It is designed for audio-enabled chat
widgets.

Key features:
- **Listens for WebSocket connections** from clients.
- **Handles Authentication**:
  - If the client's initial message contains an `accessToken`, it's used for
    the upstream connection.
  - Otherwise, it generates a new OAuth2 access token using the application's
    service account credentials (Application Default Credentials).
- **Token Caching**: Caches the generated access token in memory to reduce
  latency and avoid hitting token generation API quotas.
- **Dynamic Upstream Endpoint**: Parses the `session` string from the client's
  initial message to determine the correct regional Google Cloud WebSocket
  endpoint for both Playbooks and Next Gen Agents.
- **Message Proxying**: Transparently forwards messages between the client and
  the Google backend in both directions.
- **Connection Management**: Manages the lifecycle of both client and remote
  connections, including graceful disconnections.

Configuration is managed through environment variables:
- `PROJECT_ID`: (Optional) GCP Project ID. If not set, it's inferred from the session string.
- `WEBSOCKET_SERVER_PORT`: The local port for the proxy to listen on. Defaults to 8765.
- `TOKEN_TTL`: The time-to-live for the cached token in seconds. Defaults to 300.
- `OAUTH_SCOPES`: Comma-separated list of OAuth scopes for the token. Defaults to 'https://www.googleapis.com/auth/cloud-platform'.
- `MAX_SESSION_DURATION_SECONDS`: Hard lifetime limit of a proxied session. Defaults to 180.
- `IDLE_TIMEOUT_SECONDS`: Inactivity limit based on meaningful messages only. Defaults to 60 (0 disables).
- `CONFIG_MESSAGE_TIMEOUT_SECONDS`: Max wait for the client's initial config message. Defaults to 10.
- `AUDIO_ACTIVITY_RMS_THRESHOLD`: Normalized RMS above which client audio counts as activity. Defaults to 0.01.
"""

import array
import asyncio
import base64
import binascii
import json
import logging
import math
import os
import re
import sys
import time
import traceback
import uuid

import google.auth
import google.cloud.logging
import websockets
from google.api_core import exceptions
from google.auth.transport import requests
from websockets.client import connect
from websockets.exceptions import ConnectionClosedError, ConnectionClosedOK

PROJECT_ID_ENV = os.getenv("PROJECT_ID")
WEBSOCKET_SERVER_PORT = int(os.getenv("WEBSOCKET_SERVER_PORT", "8765"))

# Authorized origins for WebSocket connections (semicolon-separated).
# Example: "https://www.google.com;https://staging.google.com.fr;https://beta.google.com"
AUTHORIZED_ORIGINS_ENV = os.getenv("AUTHORIZED_ORIGINS", "")
AUTHORIZED_ORIGINS = [
    o.strip().rstrip("/") for o in AUTHORIZED_ORIGINS_ENV.split(";") if o.strip()
]
# Allow localhost origins only when explicitly enabled (for local development).
ALLOW_LOCALHOST = os.getenv("ALLOW_LOCALHOST", "false").lower() in ("true", "1", "yes")

PBL_ENDPOINT_TEMPLATE = "wss://{location}-dialogflow-webchannel.googleapis.com/ws/google.cloud.dialogflow.v3alpha1.Sessions/BidiStreamingDetectIntent"
PS_ENDPOINT_TEMPLATE = "wss://ces.googleapis.com/ws/google.cloud.ces.v1.SessionService/BidiRunSession/locations/{location}"

CURRENT_TOKEN = None
CURRENT_TOKEN_TIMESTAMP = None

# Filter sensitive fields from upstream responses
# When not set or empty, no filtering is applied (pass-through).
# Recommended production value:
#   STRIPPED_KEYS="rootSpan.attributes;rootSpan.childSpans"
_STRIPPED_KEYS_ENV = os.getenv("STRIPPED_KEYS")
_STRIPPED_PATHS = (
    [p.strip() for p in _STRIPPED_KEYS_ENV.split(";") if p.strip()]
    if _STRIPPED_KEYS_ENV is not None and _STRIPPED_KEYS_ENV.strip()
    else None
)

# We'll keep updated tokens only for a few minutes.
TOKEN_TTL = os.environ.get("TOKEN_TTL", "300")
try:
    TOKEN_TTL = int(TOKEN_TTL)
except (ValueError, TypeError):
    logging.warning(
        f"Invalid value for TOKEN_TTL: '{TOKEN_TTL}'. It must be an integer."
    )
    TOKEN_TTL = 300


def _env_number(name, default, cast=int, minimum=0):
    raw = os.environ.get(name)
    if raw is None or not raw.strip():
        return default
    try:
        value = cast(raw)
    except (ValueError, TypeError):
        logging.warning(f"Invalid value for {name}: '{raw}'. Using default {default}.")
        return default
    if value < minimum:
        logging.warning(f"{name} must be >= {minimum}. Using default {default}.")
        return default
    return value


# Hard lifetime limit: the session is closed when reached, whatever the traffic.
MAX_SESSION_DURATION_SECONDS = _env_number("MAX_SESSION_DURATION_SECONDS", 180, minimum=1)
# Idle limit, reset only by meaningful application messages (voice, text, images,
# variables, tool responses, agent output). WebSocket ping/pong frames and silent
# audio frames never reset it. 0 disables the idle timeout.
IDLE_TIMEOUT_SECONDS = _env_number("IDLE_TIMEOUT_SECONDS", 60)
CONFIG_MESSAGE_TIMEOUT_SECONDS = _env_number("CONFIG_MESSAGE_TIMEOUT_SECONDS", 10, minimum=1)
# Same normalized RMS threshold as the widget's VAD (src/audio/audio-helper.js).
AUDIO_ACTIVITY_RMS_THRESHOLD = _env_number(
    "AUDIO_ACTIVITY_RMS_THRESHOLD", 0.01, cast=float
)
# Bounds the closing handshake so a dead peer cannot hold a socket open.
CLOSE_TIMEOUT_SECONDS = 5

CLOSE_CODE_NORMAL = 1000
CLOSE_CODE_POLICY_VIOLATION = 1008


def _is_voice_audio(audio_b64):
    """Returns True if a base64 PCM16 LE audio chunk contains more than silence."""
    if not isinstance(audio_b64, str) or not audio_b64:
        return False
    try:
        raw = base64.b64decode(audio_b64)
    except (binascii.Error, ValueError):
        return False
    usable = len(raw) - (len(raw) % 2)
    if usable == 0:
        return False
    samples = array.array("h")
    samples.frombytes(raw[:usable])
    if sys.byteorder == "big":
        samples.byteswap()
    rms = math.sqrt(math.sumprod(samples, samples) / len(samples)) / 32768
    return rms > AUDIO_ACTIVITY_RMS_THRESHOLD


def _is_meaningful_client_message(message):
    """Tells whether a client message is real user activity.

    The widget streams audio continuously, including zero-filled buffers when the
    mic is muted (push-to-talk). Those silent chunks must not keep a session alive.
    """
    try:
        data = json.loads(message)
    except (TypeError, ValueError):
        return True
    if not isinstance(data, dict):
        return True
    realtime_input = data.get("realtimeInput")
    if not isinstance(realtime_input, dict) or set(realtime_input) != {"audio"}:
        return True
    return _is_voice_audio(realtime_input.get("audio"))


def _extract_session_id(session_string):
    match = re.search(r"/sessions/([^/?#]+)", session_string or "")
    return match.group(1) if match else None


async def _safe_close(websocket, code, reason, label, session_id):
    if websocket is None or websocket.close_code is not None:
        return
    try:
        await websocket.close(code=code, reason=reason)
    except Exception as e:
        logging.error(f"[session={session_id}] Error closing {label} websocket: {e}")


def is_origin_allowed(origin):
    """
    Checks whether the given Origin header value is in the allow-list.

    Returns True if:
      - AUTHORIZED_ORIGINS is empty (not configured — permissive fallback, logged as warning at startup).
      - The origin matches one of the configured AUTHORIZED_ORIGINS exactly.
      - ALLOW_LOCALHOST is enabled and the origin is http://localhost[:port].
    """
    if not AUTHORIZED_ORIGINS:
        # No allow-list configured — accept all (backward-compatible).
        return True

    if origin is None:
        return False

    normalized = origin.strip().rstrip("/")

    if normalized in AUTHORIZED_ORIGINS:
        return True

    if ALLOW_LOCALHOST and re.match(r"^https?://localhost(:\d+)?$", normalized):
        return True

    return False


def _delete_at_path(obj, path_parts):
    """Delete a field at the given dot-path within a JSON object.

    Args:
        obj: The parsed JSON object (dict).
        path_parts: List of path segments, e.g. ["rootSpan", "attributes"].

    Returns:
        True if the field was found and deleted.
    """
    current = obj
    for part in path_parts[:-1]:
        if isinstance(current, dict) and part in current:
            current = current[part]
        else:
            return False
    leaf = path_parts[-1]
    if isinstance(current, dict) and leaf in current:
        del current[leaf]
        return True
    return False


def _strip_diagnostic_info(message):
    """Remove fields specified by dot-path selectors from an upstream message.

    Each path in ``_STRIPPED_PATHS`` targets a specific location in the JSON
    tree (e.g. ``rootSpan.attributes``). Only the leaf field is removed;
    parent objects and sibling fields are preserved.

    Handles both text (str) and binary (bytes) WebSocket frames.
    Non-JSON frames (e.g. raw audio) are returned unchanged.

    Args:
        message: The raw WebSocket message (str or bytes).

    Returns:
        The sanitized message, or the original message unchanged.
    """
    if not _STRIPPED_PATHS:
        return message

    is_bytes = isinstance(message, bytes)

    try:
        text = message.decode("utf-8") if is_bytes else message
    except (UnicodeDecodeError, AttributeError):
        return message

    try:
        data = json.loads(text)
    except (json.JSONDecodeError, ValueError):
        return message

    if not isinstance(data, dict):
        return message

    modified = False
    for path in _STRIPPED_PATHS:
        parts = path.split(".")
        if _delete_at_path(data, parts):
            modified = True

    if not modified:
        return message

    sanitized = json.dumps(data)
    return sanitized.encode("utf-8") if is_bytes else sanitized


async def handle_client(client_websocket):
    """
    Handles a client connection, acting as a proxy to the remote WebSocket.
    """
    access_token = None
    remote_websocket = None
    project_id = PROJECT_ID_ENV
    # Replaced by the CES session id once the config message is parsed.
    session_id = f"proxy-{uuid.uuid4().hex[:12]}"
    loop = asyncio.get_running_loop()
    started_at = loop.time()
    last_activity = started_at
    close_code = CLOSE_CODE_NORMAL
    close_reason = "Session ended"

    logging.info(f"Client connected from: {client_websocket.remote_address}")

    # --- Origin verification ---
    origin = client_websocket.request.headers.get("Origin")
    if not is_origin_allowed(origin):
        logging.warning(
            f"Rejected WebSocket connection from unauthorized origin: {origin}"
        )
        await client_websocket.close(code=4003, reason="Origin not allowed")
        return

    try:

        # Step 1: Handle the initial config message
        try:
            first_message = await asyncio.wait_for(
                client_websocket.recv(), timeout=CONFIG_MESSAGE_TIMEOUT_SECONDS
            )
            first_message_json = json.loads(first_message)
            config_message = first_message_json.get(
                "configMessage", first_message_json.get("config", None)
            )

            if config_message:
                logging.debug(f"Received config message: {first_message_json}")
                access_token = config_message.pop("accessToken", None)
                environment = config_message.pop("environment", None)
                session_string = config_message.get("session", None)
                session_id = _extract_session_id(session_string) or session_id

                if access_token:
                    logging.debug("Extracted access token from config message.")
                else:
                    # Check if the token is cached and not expired
                    if (
                        CURRENT_TOKEN
                        and CURRENT_TOKEN_TIMESTAMP
                        and (time.time() - CURRENT_TOKEN_TIMESTAMP < TOKEN_TTL)
                    ):
                        logging.debug("Returning cached access token.")
                    else:  # Otherwise, refresh it
                        logging.debug(
                            "Cached token is expired or missing. Refreshing..."
                        )
                        if not refresh_token():
                            logging.warning("No access token found in config message.")
                    access_token = CURRENT_TOKEN

                if session_string:
                    # Extract location from the session string
                    match = re.search(
                        r"projects/([^/]+)/locations/(.*?)/(agents|apps)/",
                        session_string,
                    )
                    if match:
                        if not project_id:
                            project_id = match.group(1)
                        location = match.group(2)
                        session_type = match.group(3)
                        remote_websocket_url = None
                        url_template = None
                        if session_type == "agents":
                            # Playbooks Live
                            if environment and os.getenv(
                                "PBL_ENDPOINT_TEMPLATE_" + environment.upper()
                            ):
                                url_template = os.getenv(
                                    "PBL_ENDPOINT_TEMPLATE_" + environment.upper()
                                )
                            else:
                                url_template = PBL_ENDPOINT_TEMPLATE
                        else:
                            # Next Gen Agents
                            if environment and os.getenv(
                                "PS_ENDPOINT_TEMPLATE_" + environment.upper()
                            ):
                                url_template = os.getenv(
                                    "PS_ENDPOINT_TEMPLATE_" + environment.upper()
                                )
                            else:
                                url_template = PS_ENDPOINT_TEMPLATE
                        remote_websocket_url = url_template.format(location=location)
                        logging.info(
                            f"Generated remote websocket URL {remote_websocket_url}"
                        )
                    else:
                        logging.error(
                            f"Could not extract location from session {session_string}"
                        )
                        await client_websocket.close(
                            code=1002, reason="Invalid session format"
                        )
                        return
                else:
                    logging.error("No session string found in config message")
                    await client_websocket.close(
                        code=1002, reason="No session provided"
                    )
                    return

                # Inject headers, forward config message (without access token)
                headers = {
                    "Authorization": f"Bearer {access_token}",
                    "Content-Type": "application/json",
                }

                # Add the GCP billing project ID
                if project_id:
                    headers["X-Goog-User-Project"] = project_id

                # Connect to remote WS *after* getting the access token.
                try:
                    logging.info(
                        f"Connecting to remote WebSocket {remote_websocket_url}"
                    )
                    remote_websocket = await connect(
                        remote_websocket_url,
                        max_size=2**22,
                        extra_headers=headers,
                        close_timeout=CLOSE_TIMEOUT_SECONDS,
                    )
                    logging.debug("Connected to remote WebSocket.")
                except Exception as e:
                    logging.error(
                        f"Error connecting to remote WebSocket with headers: {e}"
                    )
                    await client_websocket.close(
                        code=1011, reason="Upstream service unavailable"
                    )
                    return  # close connection

                await remote_websocket.send(
                    json.dumps(first_message_json)
                )  # Send original first message

            else:
                logging.warning(
                    "First message did not contain configMessage. Closing connection."
                )
                await client_websocket.close(code=1002, reason="Invalid first message")
                return  # Close client connection if the first message is invalid

        except TimeoutError:
            logging.warning(
                f"No config message received within {CONFIG_MESSAGE_TIMEOUT_SECONDS}s. Closing connection."
            )
            await client_websocket.close(
                code=CLOSE_CODE_POLICY_VIOLATION, reason="Config message timeout"
            )
            return
        except json.JSONDecodeError:
            logging.error("Invalid JSON in first message. Closing connection.")
            await client_websocket.close(code=1002, reason="Invalid JSON")
            return
        except Exception as e:
            logging.error(f"Error processing first message {e}")
            trace = traceback.format_exc()
            logging.error(f"Full traceback:\n{trace}")

            await client_websocket.close(code=1011, reason="Internal server error")
            return

        # Step 2: Proxy subsequent messages
        def mark_activity():
            nonlocal last_activity
            last_activity = loop.time()

        async def process_messages_from_client():
            try:
                # Note: `async for` ends silently on a normal close (1000/1001),
                # so the caller must not rely on an exception to detect it.
                async for message in client_websocket:
                    if remote_websocket.close_code is not None:
                        logging.warning(
                            f"[session={session_id}] Remote WebSocket is already closed, cannot forward client message."
                        )
                        return
                    if _is_meaningful_client_message(message):
                        mark_activity()
                    await remote_websocket.send(message)
                logging.info(
                    f"[session={session_id}] Client closed the connection "
                    f"(code={client_websocket.close_code})."
                )
            except (ConnectionClosedOK, ConnectionClosedError) as e:
                logging.info(
                    f"[session={session_id}] Connection closed while proxying client messages:\n"
                    f"  code: {e.code}\n  reason: {e.reason}\n  error: {e}"
                )

        async def process_messages_from_remote():
            try:
                async for message in remote_websocket:
                    mark_activity()
                    sanitized = _strip_diagnostic_info(message) if _STRIPPED_PATHS else message
                    if not await send_msg_to_client(sanitized):
                        logging.warning(
                            f"[session={session_id}] send_msg_to_client failed. Breaking loop."
                        )
                        return
                logging.info(
                    f"[session={session_id}] Remote closed the connection "
                    f"(code={remote_websocket.close_code})."
                )
            except (ConnectionClosedOK, ConnectionClosedError) as e:
                logging.info(f"[session={session_id}] Remote connection closed: {e}")
                # send a message to the client with the reson of the connection closure
                error_msg = {
                    "connection_closed": type(e).__name__,
                    "reason": e.reason,
                    "code": e.code,
                }
                await send_msg_to_client(json.dumps(error_msg))

        async def send_msg_to_client(message):
            if client_websocket.close_code is None:
                try:
                    await client_websocket.send(message)
                except (ConnectionClosedOK, ConnectionClosedError):
                    logging.info(
                        f"[session={session_id}] Client connection closed, stopping forwarding from remote."
                    )
                    return False
                except Exception as e:
                    logging.error(f"[session={session_id}] Error sending to client: {e}")
                    trace = traceback.format_exc()
                    logging.error(f"Full traceback:\n{trace}")
                    return False
            else:
                logging.info(
                    f"[session={session_id}] Client connection is closed, not forwarding message from remote."
                )
                return False
            return True

        async def enforce_session_limits():
            """Returns the name of the first limit reached (hard lifetime or idle)."""
            while True:
                now = loop.time()
                remaining = started_at + MAX_SESSION_DURATION_SECONDS - now
                if remaining <= 0:
                    return "MAX_SESSION_DURATION"
                if IDLE_TIMEOUT_SECONDS:
                    idle_remaining = last_activity + IDLE_TIMEOUT_SECONDS - now
                    if idle_remaining <= 0:
                        return "IDLE_TIMEOUT"
                    remaining = min(remaining, idle_remaining)
                await asyncio.sleep(remaining)

        # The first task to finish (client gone, remote gone or limit reached)
        # tears down the whole session: the others are cancelled right away.
        watchdog = asyncio.create_task(enforce_session_limits())
        tasks = {
            asyncio.create_task(process_messages_from_client()),
            asyncio.create_task(process_messages_from_remote()),
            watchdog,
        }
        try:
            done, _ = await asyncio.wait(tasks, return_when=asyncio.FIRST_COMPLETED)
        finally:
            for task in tasks:
                task.cancel()
            await asyncio.gather(*tasks, return_exceptions=True)

        for task in done:
            if not task.cancelled() and task.exception() is not None:
                logging.error(
                    f"[session={session_id}] Proxy task failed: {task.exception()!r}"
                )

        if watchdog in done and not watchdog.cancelled() and watchdog.exception() is None:
            limit = watchdog.result()
            elapsed = loop.time() - started_at
            if limit == "MAX_SESSION_DURATION":
                close_code = CLOSE_CODE_POLICY_VIOLATION
                close_reason = "Max session duration exceeded"
                logging.warning(
                    f"[session={session_id}] Hard lifetime limit of {MAX_SESSION_DURATION_SECONDS}s "
                    f"reached ({elapsed:.1f}s). Force-closing client and upstream websockets."
                )
            else:
                close_reason = "Idle timeout"
                logging.warning(
                    f"[session={session_id}] No meaningful activity for {IDLE_TIMEOUT_SECONDS}s "
                    f"(session age {elapsed:.1f}s). Force-closing client and upstream websockets."
                )
            # Lets the widget treat this as an agent-requested end instead of
            # an unexpected drop, so it does not auto-reconnect.
            await send_msg_to_client(
                json.dumps({"endSession": {"metadata": {"reason": limit}}})
            )

    except ConnectionRefusedError as e:
        logging.error(f"[session={session_id}] Connection refused to remote WebSocket: {e}")
    except ConnectionClosedError as e:
        logging.error(f"[session={session_id}] Connection closed with remote WebSocket: {e}")
    except Exception as e:
        logging.error(f"[session={session_id}] An error occurred in handle_client: {e}")
    finally:
        # Both sockets are always closed here, concurrently, whatever the exit path.
        await asyncio.gather(
            _safe_close(remote_websocket, close_code, close_reason, "remote", session_id),
            _safe_close(client_websocket, close_code, close_reason, "client", session_id),
        )
        logging.info(
            f"[session={session_id}] Session closed after {loop.time() - started_at:.1f}s "
            f"(client {client_websocket.remote_address}, code={close_code}, reason='{close_reason}')."
        )


def refresh_token():
    """
    Generates an access token using Application Default Credentials and saves it
    in a global variable.

    Returns:
        bool: True on success, False on failure.
    """
    global CURRENT_TOKEN
    global CURRENT_TOKEN_TIMESTAMP
    try:
        # 1. Get configuration from environment variables.
        # These are set in deploy.sh from values.sh.
        # Scopes are expected to be a comma-separated string.
        scopes_str = os.environ.get(
            "OAUTH_SCOPES", "https://www.googleapis.com/auth/cloud-platform"
        )
        scopes = [scope.strip() for scope in scopes_str.split(",") if scope.strip()]
        if not scopes:
            raise ValueError(
                "OAUTH_SCOPES environment variable cannot be empty or contain only commas."
            )
        logging.info(f"Using OAuth scopes: {scopes}")

    except KeyError as e:
        logging.error(f"Missing environment variable: {e.args[0]}")
        return False
    except ValueError as e:
        logging.error(f"Invalid environment variable: {e}")
        return False

    try:
        # 2. Generate an access token using Application Default Credentials (ADC).
        # The ADC are taken from the service account attached to the Cloud Run Job.
        logging.info("Generating access token using ADC...")
        credentials, _ = google.auth.default(scopes=scopes)

        # The token needs to be refreshed to be valid.
        credentials.refresh(requests.Request())
        access_token = credentials.token

        if not access_token:
            raise RuntimeError("Failed to retrieve a valid access token.")
        logging.debug("Successfully generated access token.")

        # 3. Save the access token and its expiry as global variable.
        logging.debug("Saving refreshed access token and expiry...")

        # Create a JSON payload with the token and its expiry.
        CURRENT_TOKEN = access_token
        CURRENT_TOKEN_TIMESTAMP = time.time()
        return True
    except (
        google.auth.exceptions.DefaultCredentialsError,
        exceptions.GoogleAPICallError,
    ) as e:
        logging.error(f"A Google Cloud error occurred: {e}")
        logging.error(
            "Ensure the service account has the required IAM permissions on the project."
        )
        return False
    except Exception as e:
        logging.error(f"An unexpected error occurred: {e}")
        return False


async def main():
    """
    Main function to set up logging, configure the WebSocket server,
    and start the WebSocket server.
    """
    # If K_SERVICE is set, we are in a Google Cloud Run environment.
    if "K_SERVICE" in os.environ:
        # Set up Google Cloud's structured logging.
        client = google.cloud.logging.Client()
        client.setup_logging()
        logging.info("Cloud Logging initialized.")
    else:
        # For local development, use standard Python logging.
        logging.basicConfig(
            level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s"
        )
        logging.info("Standard logging initialized for local environment.")

    # --- Origin allow-list startup diagnostics ---
    if AUTHORIZED_ORIGINS:
        logging.info(f"Origin allow-list active. Authorized origins: {AUTHORIZED_ORIGINS}")
        if ALLOW_LOCALHOST:
            logging.info("Localhost origins are also allowed (ALLOW_LOCALHOST=true).")
    else:
        logging.warning(
            "AUTHORIZED_ORIGINS is not set. All origins will be accepted. "
            "Set AUTHORIZED_ORIGINS to restrict access (semicolon-separated list)."
        )

    logging.info(
        f"Session limits: max duration {MAX_SESSION_DURATION_SECONDS}s, "
        f"idle timeout {IDLE_TIMEOUT_SECONDS or 'disabled'}s, "
        f"config message timeout {CONFIG_MESSAGE_TIMEOUT_SECONDS}s."
    )

    start_server = websockets.serve(
        handle_client,
        "0.0.0.0",
        WEBSOCKET_SERVER_PORT,
        close_timeout=CLOSE_TIMEOUT_SECONDS,
    )

    logging.info(f"WebSocket server started on port {WEBSOCKET_SERVER_PORT}")

    await start_server  # this is needed because it returns a awaitable object

    await asyncio.Future()  # Run forever


if __name__ == "__main__":
    asyncio.run(main())
