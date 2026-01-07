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
from google.auth import jwt  # Added for local signing

CURRENT_TOKEN = None
CURRENT_TOKEN_TIMESTAMP = None

# YAML-defined path for the secret volume
KEY_PATH = "/secrets/token-broker-sa-key"

def print_log(severity, message):
    log_entry = {"severity": severity, "message": message}
    stream = sys.stderr if severity in ("ERROR", "CRITICAL") else sys.stdout
    print(json.dumps(log_entry), file=stream)

# Configuration
TOKEN_TTL = int(os.environ.get("TOKEN_TTL", "300"))
# New Flag: Set to "true" in environment variables to enable local signing
ENABLE_LOCAL_SIGNING = os.environ.get("ENABLE_LOCAL_SIGNING", "false").lower() == "true"

authorized_origins = []
env_origins = os.environ.get("AUTHORIZED_ORIGINS")
if env_origins:
    additional_origins = [
        origin.strip().rstrip('/') for origin in env_origins.split(";") if origin.strip()
    ]
    authorized_origins.extend(additional_origins)

@functions_framework.http
def get_access_token(request):
    origin = request.headers.get("Origin")
    is_authorized = False
    if origin:
        origin = origin.rstrip("/")
        if origin.startswith("http://localhost:") or any(origin == auth for auth in authorized_origins):
            is_authorized = True

    headers = {
        "Access-Control-Allow-Credentials": "true",
        "Access-Control-Allow-Origin": origin if is_authorized else "",
        "Access-Control-Allow-Methods": "GET",
        "Access-Control-Allow-Headers": "Content-Type",
        "Access-Control-Max-Age": "3600",
    } if is_authorized else {}

    if request.method == "OPTIONS":
        return ("", 204, headers)

    if request.method != "GET":
        return {"error": "Method Not Allowed"}, 405, headers

    # Cache Logic
    global CURRENT_TOKEN, CURRENT_TOKEN_TIMESTAMP
    if not (CURRENT_TOKEN and CURRENT_TOKEN_TIMESTAMP and (time.time() - CURRENT_TOKEN_TIMESTAMP < TOKEN_TTL)):
        print_log("DEBUG", "Token missing or expired. Generating...")
        if not refresh_token():
            return ({"error": "Failed to generate token."}, 500, headers)

    return CURRENT_TOKEN, 200, headers

def refresh_token():
    global CURRENT_TOKEN, CURRENT_TOKEN_TIMESTAMP

    try:
        scopes_str = os.environ["OAUTH_SCOPES"]
        scopes = [s.strip() for s in scopes_str.split(",") if s.strip()]
        
        if ENABLE_LOCAL_SIGNING:
            return generate_local_jwt(scopes)
        else:
            return generate_adc_token(scopes)

    except Exception as e:
        print_log("ERROR", f"Refresh failed: {e}")
        return False

def generate_local_jwt(scopes):
    """Signs a JWT locally for CES (Zero RPCs)."""
    global CURRENT_TOKEN, CURRENT_TOKEN_TIMESTAMP
    print_log("INFO", "Generating locally signed JWT for CES...")
    
    if not os.path.exists(KEY_PATH):
        print_log("ERROR", f"Secret key file not found at {KEY_PATH}")
        return False

    try:
        # 1. Load the key file
        with open(KEY_PATH, 'r') as f:
            sa_info = json.load(f)

        # 2. Setup timing and audience
        now = int(time.time())
        expiry_time = now + 3600  # 1 hour maximum
        
        # AUDIENCE: Specifically for CES API
        audience = "https://autopush-ces.sandbox.googleapis.com/"

        # 3. Create the payload
        # Google Dialogflow accepts 'scope' as a space-separated string in JWTs
        payload = {
            "iss": sa_info['client_email'],
            "sub": sa_info['client_email'],
            "aud": audience,
            "iat": now,
            "exp": expiry_time,
            "scope": " ".join(scopes)
        }

        # 4. Use the Signer directly (This avoids the __init__ error)
        # We extract the private key from the JSON info and create a signer
        signer = google.auth.crypt.RSASigner.from_service_account_info(sa_info)
        
        # 5. Sign the token
        # This is a local CPU operation. No network calls are made.
        signed_jwt = google.auth.jwt.encode(signer, payload)

        # 6. Save to global cache
        CURRENT_TOKEN = {
            "access_token": signed_jwt.decode('utf-8'),
            "expiry": expiry_time * 1000,
            "type": "signed-jwt"
        }
        CURRENT_TOKEN_TIMESTAMP = time.time()
        
        print_log("DEBUG", "Successfully generated local JWT for Dialogflow.")
        return True

    except Exception as e:
        # This will catch and log any parsing or signing errors
        print_log("ERROR", f"Failed to sign local JWT: {str(e)}")
        return False

def generate_adc_token(scopes):
    """Generates an access token using the Metadata Server (Standard RPC)."""
    global CURRENT_TOKEN, CURRENT_TOKEN_TIMESTAMP
    print_log("INFO", "Generating access token via ADC RPC...")
    credentials, _ = google.auth.default(scopes=scopes)
    credentials.refresh(requests.Request())
    
    CURRENT_TOKEN = {
        "access_token": credentials.token,
        "expiry": int(credentials.expiry.timestamp() * 1000) if credentials.expiry else None,
        "type": "oauth-access-token"
    }
    CURRENT_TOKEN_TIMESTAMP = time.time()
    return True
