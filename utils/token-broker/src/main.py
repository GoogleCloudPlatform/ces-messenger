"""Google Cloud Function for brokering Service Account access tokens.

This function serves as an HTTP-triggered endpoint to provide OAuth2 access
tokens generated from a service account's credentials. It is designed to be
used as a secure backend for client-side applications (like the ces-messenger
web component) that need to authenticate with Google Cloud APIs without
exposing credentials.

Key features:
- Handles CORS (Cross-Origin Resource Sharing) preflight (OPTIONS) and main
  (GET) requests, allowing access only from a configurable allowlist of origins.
- Caches the generated access token in memory to reduce latency and avoid
  hitting token generation API quotas. The cache duration is configurable.

Configuration is managed through the following environment variables:
- `AUTHORIZED_ORIGINS`: A semicolon-separated list of allowed origin URLs for CORS.
- `TOKEN_TTL`: The time-to-live for the cached token in seconds. Defaults to 300.
- `OAUTH_SCOPES`: A comma-separated list of OAuth scopes required for the access token.
"""

import json
import os
import sys
import time

import functions_framework
import google.auth
from google.api_core import exceptions
from google.auth.transport import requests

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
        origin.strip().rstrip('/') for origin in env_origins.split(";") if origin.strip()
    ]
    authorized_origins.extend(additional_origins)


@functions_framework.http
def get_access_token(request):
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
        origin = origin.rstrip("/")
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
            "Access-Control-Allow-Credentials": "true",
            "Access-Control-Allow-Origin": origin,
            "Access-Control-Allow-Methods": "GET",
            "Access-Control-Allow-Headers": "Content-Type",
            "Access-Control-Max-Age": "3600",
        }
    else:
        headers = {}

    # Handle CORS preflight requests.
    if request.method == "OPTIONS":
        # For preflight, return a 204 response. If the origin is not allowed,
        # the headers dict will be empty, and the browser will block the request.
        return ("", 204, headers)

    # This function should only handle GET requests for the main logic.
    if request.method != "GET":
        return {"error": "Method Not Allowed"}, 405, headers

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

    return CURRENT_TOKEN, 200, headers  # Return the (newly) cached token


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
        scopes_str = os.environ["OAUTH_SCOPES"]
        scopes = [scope.strip() for scope in scopes_str.split(",") if scope.strip()]
        if not scopes:
            raise ValueError(
                "OAUTH_SCOPES environment variable cannot be empty or contain only commas."
            )
        print_log("INFO", f"Using OAuth scopes: {scopes}")

    except KeyError as e:
        print_log("CRITICAL", f"Missing environment variable: {e.args[0]}")
        return False
    except ValueError as e:
        print_log("CRITICAL", f"Invalid environment variable: {e}")
        return False

    try:
        # 2. Generate an access token using Application Default Credentials (ADC).
        # The ADC are taken from the service account attached to the Cloud Run Job.
        print_log("INFO", "Generating access token using ADC...")
        credentials, _ = google.auth.default(scopes=scopes)

        # The token needs to be refreshed to be valid.
        credentials.refresh(requests.Request())
        access_token = credentials.token
        expiry = credentials.expiry

        if not access_token:
            raise RuntimeError("Failed to retrieve a valid access token.")
        print_log("DEBUG", "Successfully generated access token.")

        # 3. Save the access token and its expiry as global variable.
        print_log("DEBUG", "Saving refreshed access token and expiry...")

        # Create a JSON payload with the token and its expiry.
        CURRENT_TOKEN = {
            "access_token": access_token,
            "expiry": int(expiry.timestamp() * 1000) if expiry else None,
        }
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
