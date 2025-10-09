"""Google Cloud Function acting as a web proxy for the CES API.

This function serves as an HTTP-triggered endpoint that securely proxies requests
from a client-side application (like the ces-messenger in text-only mode) to the
Google Customer Engagement Suite (CES) API.

It is designed for chat widgets that use the standard HTTPS request/response API
for communication, as opposed to audio-enabled chats that use WebSockets.

Key features:
- **Request Proxying**: Forwards incoming GET and POST requests to the
  appropriate CES API endpoint.
- **Authentication Handling**: If an incoming request lacks an 'Authorization'
  header, it generates a new OAuth2 access token using the function's service
  account credentials and adds it to the request before proxying.
- **Token Caching**: Caches the generated access token in memory to reduce
  latency and avoid hitting token generation API quotas.
- **CORS Support**: Handles CORS preflight (OPTIONS) and main requests, allowing
  access only from a configurable allowlist of origins.
- **Region Validation**: Compares its own execution region with the agent's
  region to log a warning about potential cross-region latency.

Configuration is managed through environment variables:
- `AUTHORIZED_ORIGINS`: A semicolon-separated list of allowed origin URLs.
- `TOKEN_TTL`: The time-to-live for the cached token in seconds.
- `OAUTH_SCOPES`: A comma-separated list of OAuth scopes for the token.
- `DISABLE_REGION_CHECK`: Set to "true" to disable the region mismatch warning.
"""

import json
import os
import re
import sys
import time

import functions_framework
import google.auth
import google.auth.transport.requests
import requests
from google.api_core import exceptions

CES_API_DOMAIN = os.getenv("CES_API_DOMAIN", "ces.googleapis.com")
CES_API_VERSION = "v1"

# Keep latest token in cache for TOKEN_TTL seconds
CURRENT_TOKEN = None
CURRENT_TOKEN_TIMESTAMP = None


def print_log(severity, message):
    """Prints a structured log message to the appropriate stream."""
    log_entry = {
        "severity": severity,
        "message": message,
    }
    # Select stream based on severity for proper log handling in Cloud Functions
    stream = sys.stderr if severity in ("ERROR", "CRITICAL") else sys.stdout
    print(json.dumps(log_entry), file=stream)


# We'll keep updated tokens only for a few minutes.
TOKEN_TTL = os.environ.get("TOKEN_TTL", "300")
try:
    TOKEN_TTL = int(TOKEN_TTL)
except (ValueError, TypeError):
    print_log(
        "WARNING", f"Invalid value for TOKEN_TTL: '{TOKEN_TTL}'. It must be an integer."
    )
    # Fallback to a safe default
    TOKEN_TTL = 300

authorized_origins = []

# Add origins from the environment variable if it exists.
env_origins = os.environ.get("AUTHORIZED_ORIGINS")
if env_origins:
    # Split by comma and strip any whitespace from each origin.
    additional_origins = [
        origin.strip() for origin in env_origins.split(";") if origin.strip()
    ]
    authorized_origins.extend(additional_origins)


def find_current_region():
    """Determines the Google Cloud region where the function is executing.

    This function attempts to find the region by first querying the GCP metadata
    server. If that fails (e.g., when running locally), it falls back to checking
    the `FUNCTION_REGION` environment variable.

    The region check can be disabled by setting the `DISABLE_REGION_CHECK`
    environment variable to "true".

    Returns:
        str or None: The region string (e.g., 'us-central1') if found,
                     otherwise None.
    """
    cf_region = None
    metadata_headers = {"Metadata-Flavor": "Google"}
    if os.environ.get("DISABLE_REGION_CHECK", "false").lower() != "true":
        # First, try to get the region from the metadata server for reliability.
        try:
            metadata_url = (
                "http://metadata.google.internal/computeMetadata/v1/instance/region"
            )
            response = requests.get(metadata_url, headers=metadata_headers, timeout=2)
            response.raise_for_status()
            # The response is a full path like 'projects/123456/regions/us-central1'.
            # We just need the last part.
            cf_region = response.text.split("/")[-1]
            print_log(
                "INFO", f"Got Cloud Function region from metadata server: {cf_region}."
            )
        except requests.exceptions.RequestException as e:
            print_log(
                "WARNING",
                f"Could not contact metadata server to get region: {e}. Falling back to environment variable.",
            )
            # Fallback to environment variable if metadata server is not available.
            cf_region = os.environ.get("FUNCTION_REGION")
            if cf_region:
                print_log(
                    "INFO",
                    f"Got Cloud Function region from FUNCTION_REGION env var: {cf_region}.",
                )
    if not cf_region:
        print_log(
            "WARNING",
            "Could not determine the region where the Cloud Function is running",
        )
    return cf_region


# Try to find the region where the Cloud Function is running.
CF_REGION = find_current_region()


@functions_framework.http
def ces_agent_request(request):
    """HTTP Cloud Function to retrieve an access token for the SA running this
    Cloud Function.

    It also handles CORS preflight requests and adds CORS headers to
    responses for allowed origins.

    Args:
        request (flask.Request): The request object.

    Returns:
        A JSON response containing the access token and expiry, or an error
        message.
        The response includes CORS headers for allowed origins.

    """

    # Determine the origin and prepare CORS headers. These headers will be used
    # for both preflight and main requests to ensure consistency.
    origin = request.headers.get("Origin")

    is_authorized = False
    if origin:
        if origin.startswith("http://localhost:"):
            is_authorized = True
        else:
            for authorized_origin in authorized_origins:
                if isinstance(authorized_origin, str) and origin == authorized_origin:
                    is_authorized = True
                    break
                if hasattr(authorized_origin, "match") and authorized_origin.match(
                    origin
                ):
                    is_authorized = True
                    break

    if is_authorized:
        headers = {
            "Access-Control-Allow-Origin": origin,
            "Access-Control-Allow-Methods": "GET, POST",
            "Access-Control-Allow-Headers": "Content-Type, user-agent, Authorization",
            "Access-Control-Max-Age": "3600",
        }
    else:
        headers = {}

    # Handle CORS preflight requests.
    if request.method == "OPTIONS":
        # For preflight, return a 204 response. If the origin is not allowed,
        # the headers dict will be empty, and the browser will block the request.
        return ("", 204, headers)

    # --- Check Region ---
    if CF_REGION:
        check_region(CF_REGION, request.path)

    # --- Proxy the request ---
    downstream_headers = dict(request.headers)
    downstream_headers["Host"] = CES_API_DOMAIN

    # Add an access token if not found in the original request headers
    if "Authorization" not in downstream_headers:
        # Check if the token is cached and not expired
        if (
            CURRENT_TOKEN
            and CURRENT_TOKEN_TIMESTAMP
            and (time.time() - CURRENT_TOKEN_TIMESTAMP < TOKEN_TTL)
        ):
            print_log("DEBUG", "Returning cached access token.")
        else:  # Otherwise, refresh it
            print_log("DEBUG", "Cached token is expired or missing. Refreshing...")
            if not refresh_token():
                # If refresh fails, return an error. This ensures logs are flushed.
                return (
                    {
                        "error": "Failed to generate a new access token. Check server logs for details."
                    },
                    500,
                    headers,
                )
        downstream_headers["Authorization"] = f"Bearer {CURRENT_TOKEN}"
    else:
        print_log(
            "DEBUG",
            "Authorization header already found in the original request headers.",
        )

    downstream_url = f"https://{CES_API_DOMAIN}/{CES_API_VERSION}{request.path}"

    print_log("DEBUG", f"Connecting to CES API: {downstream_url}")

    try:
        if request.method == "GET":
            downstream_response = requests.get(
                downstream_url,
                headers=downstream_headers,
                params=request.args,
                timeout=30,
            )
        elif request.method == "POST":
            downstream_response = requests.post(
                downstream_url,
                headers=downstream_headers,
                data=request.get_data(),
                params=request.args,
                timeout=30,
            )
        else:
            return (f"Unsupported method: {request.method}", 405, None)

    except requests.exceptions.RequestException as e:
        error_message = f"Error proxying request to downstream server: {e}"
        print_log("ERROR", error_message)
        return (error_message, 502, None)

    # --- Return Downstream Response ---
    # Exclude certain headers from being forwarded
    excluded_headers = [
        "content-encoding",
        "content-length",
        "transfer-encoding",
        "connection",
    ]
    response_headers = [
        (k, v)
        for k, v in downstream_response.headers.items()
        if k.lower() not in excluded_headers
    ]

    return (
        downstream_response.content,
        downstream_response.status_code,
        response_headers,
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
        print_log("INFO", "Refreshing access token...")
        scopes_str = os.environ["OAUTH_SCOPES"]
        scopes = [scope.strip() for scope in scopes_str.split(",") if scope.strip()]
        if not scopes:
            raise ValueError(
                "OAUTH_SCOPES environment variable cannot be empty or contain only commas."
            )
        print_log("DEBUG", f"Using OAuth scopes: {scopes}")

    except KeyError as e:
        print_log("CRITICAL", f"Missing environment variable: {e.args[0]}")
        return False
    except ValueError as e:
        print_log("CRITICAL", f"Invalid environment variable: {e}")
        return False

    try:
        # 2. Generate an access token using Application Default Credentials (ADC).
        # The ADC are taken from the service account attached to the Cloud Run Job.
        print_log("DEBUG", "Generating access token using ADC...")
        credentials, _ = google.auth.default(scopes=scopes)

        # The token needs to be refreshed to be valid.
        credentials.refresh(google.auth.transport.requests.Request())
        access_token = credentials.token

        if not access_token:
            raise RuntimeError("Failed to retrieve a valid access token.")
        print_log("DEBUG", "Successfully generated access token.")

        # 3. Save the access token and its expiry as global variable.
        CURRENT_TOKEN = access_token
        CURRENT_TOKEN_TIMESTAMP = time.time()
        return True
    except (
        google.auth.exceptions.DefaultCredentialsError,
        exceptions.GoogleAPICallError,
    ) as e:
        print_log("ERROR", f"A Google Cloud error occurred: {e}")
        print_log(
            "ERROR",
            "Ensure the service account has the required IAM permissions on the secret and/or project.",
        )
        return False
    except Exception as e:
        print_log("ERROR", f"An unexpected error occurred: {e}")
        return False


def check_region(cf_region, agent_id):
    """Compares the region of the Cloud Function with the region of the CES agent.

    If the regions do not match, a warning is logged, as this can lead to
    increased latency. This function handles both specific regions (e.g.,
    'us-east1') and multi-regions (e.g., 'us', 'eu') by mapping them to
    default specific regions.

    Args:
        cf_region (str): The region of the Cloud Function.
        agent_id (str): The full resource name of the CES agent, from which
                        the agent's region is extracted.
                        e.g., "projects/my-project/locations/us-east1/apps/my-app"

    Returns:
        None. This function only logs a warning if regions do not match.
    """
    if not cf_region:
        return

    multi_region_map = {"eu": "europe-west1", "us": "us-central1"}

    # extract the location from the agent ID: "projects/my-project-id/locations/us/apps/2462faec-84d5-41f8-9df5-34a68b2d7dac/tools/d7fb8be4-732d-491c-9670-00c2700145d9"
    match = re.search(r"projects/[^/]+/locations/([^/]+)", agent_id)
    if match:
        agent_region = match.group(1)
        agent_region = multi_region_map.get(agent_region, agent_region)
        # Compare the base region, ignoring zones (e.g., 'us-east1' vs 'us-east1-b')
        if not agent_region.startswith(cf_region):
            print_log(
                "WARNING",
                f"Cloud Function region '{cf_region}' does not match agent region '{agent_region}'. This may cause increased latency.",
            )
