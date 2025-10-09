#!/bin/bash
set -e # Exit immediately if a command exits with a non-zero status.
set -u # Treat unset variables as an error when substituting.
set -o pipefail # Pipeline's return status is the value of the last command to exit with a non-zero status.

# --- Configuration ---
# This script requires the PROJECT_ID environment variable to be set.
if [[ -z "${PROJECT_ID:-}" ]]; then
  echo "Error: PROJECT_ID environment variable is not set."
  echo "Please set it before running the script, e.g.:"
  echo "export PROJECT_ID='your-gcp-project-id'"
  exit 1
fi

REGION="${REGION:-us-central1}"
AUTHORIZED_ORIGINS="${AUTHORIZED_ORIGINS:-}"

WEB_PROXY_SA_NAME="ces-web-proxy"
FUNCTION_NAME="ces-web-proxy"
ENTRY_POINT="ces_agent_request"

# Cloud Run Job specific configurations
TOKEN_TTL="300" # 5 minutes TTL for recently created access tokens

# OAUTH_SCOPES for the service account used by the Cloud Run job to obtain tokens.
# This scope allows broad access to Google Cloud resources. Adjust if a more specific scope is known for 'roles/ces.client'.
OAUTH_SCOPES="https://www.googleapis.com/auth/cloud-platform"

# Construct full SA email addresses
WEB_PROXY_SA_EMAIL="${WEB_PROXY_SA_NAME}@${PROJECT_ID}.iam.gserviceaccount.com"

echo "--- Starting setup for project: $PROJECT_ID ---"

# --- 0. Enable GCP Services ---
echo
echo "0. Enabling required GCP services..."
gcloud services enable \
    iam.googleapis.com \
    cloudresourcemanager.googleapis.com \
    cloudfunctions.googleapis.com \
    --project="$PROJECT_ID"
echo "   - Services enabled."

# --- 1. Create Service Accounts ---
echo
echo "1. Creating Service Accounts..."

SAs=("$WEB_PROXY_SA_NAME")
for sa_name in "${SAs[@]}"; do
    if gcloud iam service-accounts describe "${sa_name}@${PROJECT_ID}.iam.gserviceaccount.com" --project="$PROJECT_ID" &>/dev/null; then
        echo "   - Service Account '$sa_name' already exists. Skipping creation."
    else
        echo "   - Creating Service Account '$sa_name'..."
        gcloud iam service-accounts create "$sa_name" \
            --project="$PROJECT_ID" \
            --display-name="$sa_name"
        sleep 2
    fi
done

# --- 2. Grant Project-level IAM Role ---
echo
echo "2. Granting 'roles/ces.client' to '$WEB_PROXY_SA_EMAIL'..."
gcloud projects add-iam-policy-binding "$PROJECT_ID" \
    --member="serviceAccount:${WEB_PROXY_SA_EMAIL}" \
    --role="roles/ces.client" \
    --condition=None # Explicitly set no condition
echo "   - Role granted successfully."

# --- 5. Deploy Cloud Function ---
echo
echo "5. Deploying Cloud Function..."

# Store current directory to return to it later
CURRENT_DIR=$(pwd)

# Deploy Web Proxy Cloud Function
echo "   - Deploying Web Proxy Cloud Function '$FUNCTION_NAME'..."
cd "${CURRENT_DIR}/src" || exit 1 # Navigate to the function's root directory

# Set environment variables required by the deploy script
export FUNCTION_NAME="$FUNCTION_NAME"
export SERVICE_ACCOUNT="$WEB_PROXY_SA_EMAIL"
export ENTRY_POINT="$ENTRY_POINT"
export AUTHORIZED_ORIGINS="$AUTHORIZED_ORIGINS"
export REGION="$REGION"
export OAUTH_SCOPES="$OAUTH_SCOPES"

ENV_VARS="OAUTH_SCOPES=$OAUTH_SCOPES"

# Add AUTHORIZED_ORIGINS only if it's set and not empty
if [[ -n "${AUTHORIZED_ORIGINS:-}" ]]; then
  ENV_VARS+=",AUTHORIZED_ORIGINS=$AUTHORIZED_ORIGINS"
fi

if [[ -n "${CES_API_DOMAIN:-}" ]]; then
  ENV_VARS+=",CES_API_DOMAIN=$CES_API_DOMAIN"
fi

gcloud functions deploy $FUNCTION_NAME \
    --runtime=python312 \
    --gen2 \
    --trigger-http \
    --allow-unauthenticated \
    --service-account=$SERVICE_ACCOUNT \
    --entry-point=$ENTRY_POINT \
    --project=$PROJECT_ID \
    --region=$REGION \
    --min-instances=1 \
    --concurrency=20 \
    --memory=256M \
    --cpu=1 \
    --set-env-vars="$ENV_VARS"

# Unset environment variables to avoid leakage
unset SERVICE_ACCOUNT ENTRY_POINT AUTHORIZED_ORIGINS

cd "$CURRENT_DIR" # Return to original directory

echo
echo "--- 6. Post-deployment Information and Verification ---"
echo
echo "   - Console URLs for created resources:"
echo "     - Cloud Func:  https://console.cloud.google.com/functions/details/${REGION}/${FUNCTION_NAME}?project=${PROJECT_ID}"
echo

echo
echo "   - Verifying the 'ces-web-proxy' Cloud Function..."

# Retrieve the Cloud Function URL
FUNCTION_URL=$(gcloud functions describe "$FUNCTION_NAME" \
    --project="$PROJECT_ID" \
    --region="$REGION" \
    --format="value(serviceConfig.uri)")

if [[ -z "$FUNCTION_URL" ]]; then
    echo "     - Error: Could not retrieve the Cloud Function URL."
    exit 1
fi

echo "     - Function URL: $FUNCTION_URL"
echo

echo "   - To verify the function and test CORS, you can run the following commands."
echo "     Replace 'https://your-website-origin.com' with one of the origins you authorized in AUTHORIZED_ORIGINS."
echo
echo "     - Test CORS preflight request (OPTIONS):"
echo "       curl -i -X OPTIONS \"$FUNCTION_URL\" \\"
echo "         -H \"Access-Control-Request-Method: GET\" \\" 
echo "         -H \"Access-Control-Request-Headers: Content-Type\" \\" 
echo "         -H \"Origin: https://your-website-origin.com\""
echo
echo "     - Test token retrieval (GET):"
echo "       curl -i \"$FUNCTION_URL\" -H \"Origin: https://your-website-origin.com\" "
echo

echo "--- Setup complete! ---"
