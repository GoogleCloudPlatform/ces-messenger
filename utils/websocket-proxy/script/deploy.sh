#!/bin/bash

# Exit immediately if a command exits with a non-zero status.
set -e
set -u # Treat unset variables as an error when substituting.
set -o pipefail # Pipeline's return status is the value of the last command to exit with a non-zero status.

# --- Configuration ---
if [[ -z "${PROJECT_ID:-}" ]]; then
  echo "Error: PROJECT_ID environment variable is not set."
  echo "Please set it before running the script, e.g.: export PROJECT_ID='your-gcp-project-id'"
  exit 1
fi

# Determine the script's directory to make paths relative to the script.
SCRIPT_DIR=$( cd -- "$( dirname -- "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )

# The source for the Cloud Run service is the parent directory of this script.
SOURCE_DIR="${SCRIPT_DIR}/../src"

SERVICE_NAME="ces-websocket-proxy"
LOCATION="${REGION:-us-central1}"
TIMEOUT="60s"
WEBSOCKET_PROXY_SA_NAME="ces-websocket-proxy"
OAUTH_SCOPES="https://www.googleapis.com/auth/cloud-platform"

# Construct full SA email address
WEBSOCKET_PROXY_SA_EMAIL="${WEBSOCKET_PROXY_SA_NAME}@${PROJECT_ID}.iam.gserviceaccount.com"

echo "--- Starting setup for project: $PROJECT_ID ---"

# --- 0. Enable GCP Services ---
echo
echo "0. Enabling required GCP services..."
gcloud services enable \
    run.googleapis.com \
    iam.googleapis.com \
    cloudresourcemanager.googleapis.com \
    cloudbuild.googleapis.com \
    --project="$PROJECT_ID"
echo "   - Services enabled."

# --- 1. Create Service Account ---
echo
echo "1. Creating Service Account..."
if gcloud iam service-accounts describe "${WEBSOCKET_PROXY_SA_EMAIL}" --project="$PROJECT_ID" &>/dev/null; then
    echo "   - Service Account '$WEBSOCKET_PROXY_SA_NAME' already exists. Skipping creation."
else
    echo "   - Creating Service Account '$WEBSOCKET_PROXY_SA_NAME'..."
    gcloud iam service-accounts create "$WEBSOCKET_PROXY_SA_NAME" \
        --project="$PROJECT_ID" \
        --display-name="CES Websocket Proxy Service Account"

    echo "   - Waiting for service account to be ready..."
    for i in {1..12}; do
        if gcloud iam service-accounts describe "${WEBSOCKET_PROXY_SA_EMAIL}" --project="$PROJECT_ID" &>/dev/null; then
            echo "   - Service account is ready."
            break
        fi
        echo "     (Attempt $i/12) Service account not found, retrying in 5s..."
        sleep 5
    done

    if ! gcloud iam service-accounts describe "${WEBSOCKET_PROXY_SA_EMAIL}" --project="$PROJECT_ID" &>/dev/null; then
        echo "Error: Service account could not be verified after 60 seconds. Aborting."
        exit 1
    fi
fi

# --- 2. Grant Project-level IAM Role ---
echo
echo "2. Granting 'roles/ces.client' to '$WEBSOCKET_PROXY_SA_EMAIL'..."
gcloud projects add-iam-policy-binding "$PROJECT_ID" \
    --member="serviceAccount:${WEBSOCKET_PROXY_SA_EMAIL}" \
    --role="roles/ces.client" \
    --condition=None # Explicitly set no condition
echo "   - Role granted successfully."

# --- 3. Deploy Cloud Run Service ---
echo
echo "3. Deploying Cloud Run service '$SERVICE_NAME' from source folder '$SOURCE_DIR'..."

ENV_VARS="WEBSOCKET_SERVER_PORT=8080,OAUTH_SCOPES=$OAUTH_SCOPES"

# Add dev endpoints, if defined
if [[ -n "${PS_ENDPOINT_TEMPLATE_DEV:-}" ]]; then
  ENV_VARS+=",PS_ENDPOINT_TEMPLATE_DEV=$PS_ENDPOINT_TEMPLATE_DEV"
fi

if [[ -n "${PBL_ENDPOINT_TEMPLATE_DEV:-}" ]]; then
  ENV_VARS+=",PBL_ENDPOINT_TEMPLATE_DEV=$PBL_ENDPOINT_TEMPLATE_DEV"
fi

gcloud run deploy "$SERVICE_NAME" \
  --source="$SOURCE_DIR" \
  --platform=managed \
  --region="$LOCATION" \
  --cpu=1 \
  --memory=1Gi \
  --min-instances=4 \
  --max-instances=50 \
  --service-account="$WEBSOCKET_PROXY_SA_EMAIL" \
  --allow-unauthenticated \
  --project="$PROJECT_ID" \
  --timeout="$TIMEOUT" \
  --set-env-vars="$ENV_VARS" \
  --session-affinity

echo "   - Deployment of service '$SERVICE_NAME' completed successfully."

echo
echo "--- Post-deployment Information ---"

SERVICE_URL=$(gcloud run services describe "$SERVICE_NAME" \
    --platform=managed \
    --region="$LOCATION" \
    --project="$PROJECT_ID" \
    --format="value(status.url)" | sed -e 's/http/ws/')

echo
echo "   - Console URL: https://console.cloud.google.com/run/detail/${LOCATION}/${SERVICE_NAME}/revisions?project=${PROJECT_ID}"
echo "   - Websocket proxy URL: ${SERVICE_URL}"
echo

echo
echo "--- Setup complete! ---"
