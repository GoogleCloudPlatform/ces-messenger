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

# Also requires the AUTHORIZED_ORIGINS environment variable to be set.
if [[ -z "${AUTHORIZED_ORIGINS:-}" ]]; then
  echo "Error: AUTHORIZED_ORIGINS environment variable is not set."
  echo "Please set it before running the script, e.g.:"
  echo "export AUTHORIZED_ORIGINS='https://my-domain.com;https://my-domain-stg.com:3000'"
  exit 1
fi

# 2. Check for ENABLE_LOCAL_SIGNING, default to "false" if not set
# Usage: export ENABLE_LOCAL_SIGNING="true" to enable.
ENABLE_LOCAL_SIGNING="${ENABLE_LOCAL_SIGNING:-false}"

REGION="us-central1"

TOKEN_BROKER_SA_NAME="ces-token-broker"

# Cloud Run Job specific configurations
TOKEN_TTL="300" # 5 minutes TTL for recently created access tokens

# OAUTH_SCOPES for the service account used by the Cloud Run job to obtain tokens.
# This scope allows broad access to Google Cloud resources. Adjust if a more specific scope is known for 'roles/ces.client'.
OAUTH_SCOPES="https://www.googleapis.com/auth/cloud-platform"

# Cloud Function specific configurations
FUNCTION_NAME="ces-token-broker"
ENTRY_POINT="get_access_token" # The name of the Python function to execute.

# Secret Manager Configurations
SECRET_NAME="token-broker-sa-key"
LOCAL_KEY_FILE="temp-sa-key.json"

# Construct full SA email addresses
TOKEN_BROKER_SA_EMAIL="${TOKEN_BROKER_SA_NAME}@${PROJECT_ID}.iam.gserviceaccount.com"

echo "--- Starting setup for project: $PROJECT_ID ---"

# --- 0. Enable GCP Services ---
echo
echo "0. Enabling required GCP services..."
gcloud services enable \
    iam.googleapis.com \
    cloudresourcemanager.googleapis.com \
    cloudfunctions.googleapis.com \
    secretmanager.googleapis.com \
    --project="$PROJECT_ID"
echo "   - Services enabled."

# --- 1. Create Service Accounts ---
echo
echo "1. Creating Service Accounts..."

SAs=("$TOKEN_BROKER_SA_NAME")
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
echo "2. Granting 'roles/ces.client' to '$TOKEN_BROKER_SA_EMAIL'..."
gcloud projects add-iam-policy-binding "$PROJECT_ID" \
    --member="serviceAccount:${TOKEN_BROKER_SA_EMAIL}" \
    --role="roles/ces.client" \
    --condition=None # Explicitly set no condition
echo "   - Role granted successfully."

# --- 3. Conditional Secret Manager Setup ---
# Initialize deployment variables
DEPLOY_MOUNT_FLAG=""
# Default env var to false; will be overwritten if enabled
DEPLOY_ENV_VAR_FLAG="ENABLE_LOCAL_SIGNING=false"

if [ "$ENABLE_LOCAL_SIGNING" = "true" ]; then
    echo
    echo "3. [Local Signing Enabled] Setting up Secret Manager..."

    # 3a. Generate Key
    echo "   - Generating new private key file..."
    gcloud iam service-accounts keys create "$LOCAL_KEY_FILE" \
        --iam-account="$TOKEN_BROKER_SA_EMAIL" \
        --project="$PROJECT_ID"

    # 3b. Create Secret Container
    if ! gcloud secrets describe "$SECRET_NAME" --project="$PROJECT_ID" &>/dev/null; then
        echo "   - Creating Secret '$SECRET_NAME'..."
        gcloud secrets create "$SECRET_NAME" --replication-policy="automatic" --project="$PROJECT_ID"
    fi

    # 3c. Upload Key
    echo "   - Uploading key to Secret Manager..."
    gcloud secrets versions add "$SECRET_NAME" --data-file="$LOCAL_KEY_FILE" --project="$PROJECT_ID"
    
    # Clean up local file securely
    rm "$LOCAL_KEY_FILE"

    # 3d. Grant Access
    echo "   - Granting Secret Accessor role..."
    gcloud secrets add-iam-policy-binding "$SECRET_NAME" \
        --member="serviceAccount:${TOKEN_BROKER_SA_EMAIL}" \
        --role="roles/secretmanager.secretAccessor" \
        --project="$PROJECT_ID" > /dev/null

    # 3e. Set Deployment Flags for Secret Mount
    DEPLOY_MOUNT_FLAG="--mount-secret /secrets/token-broker-sa-key=${SECRET_NAME}:latest"
    DEPLOY_ENV_VAR_FLAG="ENABLE_LOCAL_SIGNING=true"
else
    echo
    echo "3. [Local Signing Disabled] Skipping Secret Manager setup."
fi

# --- 5. Deploy Cloud Function ---
echo
echo "5. Deploying Cloud Function..."

# Store current directory to return to it later
CURRENT_DIR=$(pwd)

# Deploy Access Token Broker Cloud Function
echo "   - Deploying Access Token Broker Cloud Function '$FUNCTION_NAME'..."
cd "${CURRENT_DIR}/src" || exit 1 # Navigate to the function's root directory

# Set environment variables required by the deploy script
export FUNCTION_NAME="$FUNCTION_NAME"
export SERVICE_ACCOUNT="$TOKEN_BROKER_SA_EMAIL"
export ENTRY_POINT="$ENTRY_POINT"
export AUTHORIZED_ORIGINS="$AUTHORIZED_ORIGINS"
export REGION="$REGION"
export OAUTH_SCOPES="$OAUTH_SCOPES"
export PROJECT_ID="$PROJECT_ID"
export ENABLE_LOCAL_SIGNING="$ENABLE_LOCAL_SIGNING"
export SECRET_NAME="$SECRET_NAME"

# Execute the deploy script
../script/deploy.sh

# Unset environment variables to avoid leakage
unset SERVICE_ACCOUNT ENTRY_POINT AUTHORIZED_ORIGINS ENABLE_LOCAL_SIGNING SECRET_NAME

cd "$CURRENT_DIR" # Return to original directory

echo
echo "--- 6. Post-deployment Information and Verification ---"
echo
echo "   - Console URLs for created resources:"
echo "     - Cloud Func:  https://console.cloud.google.com/functions/details/${REGION}/${FUNCTION_NAME}?project=${PROJECT_ID}"
echo

echo
echo "   - Verifying the 'token-broker' Cloud Function..."

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
echo "     Replace 'https://your-website-origin.com' with one of the origins you authorized in 'token-broker/main.py'."
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
