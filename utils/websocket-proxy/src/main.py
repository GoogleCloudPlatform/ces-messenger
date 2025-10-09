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
"""

import asyncio
import json
import logging
import os
import re
import time
import traceback

import google.auth
import google.cloud.logging
import websockets
from google.api_core import exceptions
from google.auth.transport import requests
from websockets.client import connect
from websockets.exceptions import ConnectionClosedError, ConnectionClosedOK

PROJECT_ID_ENV = os.getenv("PROJECT_ID")
WEBSOCKET_SERVER_PORT = int(os.getenv("WEBSOCKET_SERVER_PORT", "8765"))

PBL_ENDPOINT_TEMPLATE = "wss://{location}-dialogflow-webchannel.googleapis.com/ws/google.cloud.dialogflow.v3alpha1.Sessions/BidiStreamingDetectIntent"
PS_ENDPOINT_TEMPLATE = "wss://ces.googleapis.com/ws/google.cloud.ces.v1.SessionService/BidiRunSession/locations/{location}"

CURRENT_TOKEN = None
CURRENT_TOKEN_TIMESTAMP = None

# We'll keep updated tokens only for a few minutes.
TOKEN_TTL = os.environ.get("TOKEN_TTL", "300")
try:
    TOKEN_TTL = int(TOKEN_TTL)
except (ValueError, TypeError):
    logging.warning(
        f"Invalid value for TOKEN_TTL: '{TOKEN_TTL}'. It must be an integer."
    )
    TOKEN_TTL = 300


async def handle_client(client_websocket):
    """
    Handles a client connection, acting as a proxy to the remote WebSocket.
    """
    access_token = None
    remote_websocket = None
    project_id = PROJECT_ID_ENV

    logging.info(f"Client connected from: {client_websocket.remote_address}")

    try:

        # Step 1: Handle the initial config message
        try:
            first_message = await client_websocket.recv()
            first_message_json = json.loads(first_message)
            config_message = first_message_json.get(
                "configMessage", first_message_json.get("config", None)
            )

            if config_message:
                logging.debug(f"Received config message: {first_message_json}")
                access_token = config_message.pop("accessToken", None)
                environment = config_message.pop("environment", None)
                session_string = config_message.get("session", None)

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
                        remote_websocket_url, max_size=2**22, extra_headers=headers
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
        async def process_messages_from_client():
            try:
                async for message in client_websocket:
                    # logging.info("Received message from client, forwarding to remote...")
                    if remote_websocket and remote_websocket.close_code is None:
                        await remote_websocket.send(message)
                    elif not remote_websocket:
                        logging.warning(
                            "Remote WebSocket is not connected, cannot forward client message."
                        )
                    elif remote_websocket.close_code is not None:
                        logging.warning(
                            "Remote WebSocket is already closed, cannot forward client message."
                        )
                        break  # Exit the loop if remote is closed
            except (ConnectionClosedOK, ConnectionClosedError) as e:
                logging.info(
                    f"Client disconnected:\n  code: {e.code}\n  reason: {e.reason}\n  error: {e}"
                )
                if remote_websocket and remote_websocket.close_code is None:
                    logging.info(
                        "Client disconnected, explicitly closing remote websocket."
                    )
                    await remote_websocket.close()
                return  # Exit the process_messages_from_client coroutine
            except Exception as e:
                logging.error(f"Error forwarding client message to remote: {e}")
                if remote_websocket and remote_websocket.close_code is None:
                    logging.info(
                        "Error in client forwarding, attempting to close remote websocket."
                    )
                    await remote_websocket.close()
                return  # Exit on error

        async def process_messages_from_remote():
            try:
                async for message in remote_websocket:
                    if not await send_msg_to_client(message):
                        logging.warning("send_msg_to_client failed. Breaking loop.")
                        break
            except (ConnectionClosedOK, ConnectionClosedError) as e:
                logging.info(f"Remote connection closed: {e}")
                # send a message to the client with the reson of the connection closure
                error_msg = {
                    "connection_closed": type(e).__name__,
                    "reason": e.reason,
                    "code": e.code,
                }
                await send_msg_to_client(json.dumps(error_msg))
                # Then close the connection with the client
                if client_websocket and client_websocket.close_code is None:
                    logging.info(
                        "Remote disconnected, explicitly closing client websocket."
                    )
                    await client_websocket.close()
            except Exception as e:
                logging.error(f"Error in process_messages_from_remote: {e}")
                trace = traceback.format_exc()
                logging.error(f"Full traceback:\n{trace}")
            finally:
                logging.info("Exiting process_messages_from_remote loop.")

        async def send_msg_to_client(message):
            if client_websocket.close_code is None:
                try:
                    await client_websocket.send(message)
                except (ConnectionClosedOK, ConnectionClosedError):
                    logging.info(
                        "Client connection closed, stopping forwarding from remote."
                    )
                    return False
                except Exception as e:
                    logging.error(f"Error sending to client: {e}")
                    trace = traceback.format_exc()
                    logging.error(f"Full traceback:\n{trace}")
                    return False
            else:
                logging.info(
                    "Client connection is closed, not forwarding message from remote."
                )
                return False
            return True

        # Run forwarding tasks concurrently
        await asyncio.gather(
            process_messages_from_client(), process_messages_from_remote()
        )

    except ConnectionRefusedError as e:
        logging.error(f"Connection refused to remote WebSocket: {e}")
    except ConnectionClosedError as e:
        logging.error(f"Connection closed with remote WebSocket: {e}")
    except Exception as e:
        logging.error(f"An error occurred in handle_client: {e}")
    finally:
        logging.info(
            f"Client disconnected from: {client_websocket.remote_address} (handle_client finally)"
        )
        if remote_websocket and remote_websocket.close_code is None:
            try:
                await remote_websocket.close()  # Close connection in finally as a backup
            except Exception as e:
                logging.error(f"Error closing remote websocket in finally: {e}")


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

    start_server = websockets.serve(handle_client, "0.0.0.0", WEBSOCKET_SERVER_PORT)

    logging.info(f"WebSocket server started on port {WEBSOCKET_SERVER_PORT}")

    await start_server  # this is needed because it returns a awaitable object

    await asyncio.Future()  # Run forever


if __name__ == "__main__":
    asyncio.run(main())
