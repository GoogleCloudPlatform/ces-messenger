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

# These values must match the ones used in install.sh to target the correct resources.
SERVICE_NAME="ces-websocket-proxy"
LOCATION="${REGION:-us-central1}"
WEBSOCKET_PROXY_SA_NAME="ces-websocket-proxy"

# Construct full SA email address
WEBSOCKET_PROXY_SA_EMAIL="${WEBSOCKET_PROXY_SA_NAME}@${PROJECT_ID}.iam.gserviceaccount.com"

echo "--- Starting teardown for project: $PROJECT_ID ---"

# --- 1. Delete Cloud Run Service ---
echo
echo "1. Deleting Cloud Run service '$SERVICE_NAME'..."
if gcloud run services describe "$SERVICE_NAME" --region "$LOCATION" --project "$PROJECT_ID" &>/dev/null; then
    gcloud run services delete "$SERVICE_NAME" \
        --platform=managed \
        --region="$LOCATION" \
        --project="$PROJECT_ID" \
        --quiet
    echo "   - Cloud Run service '$SERVICE_NAME' deleted."
else
    echo "   - Cloud Run service '$SERVICE_NAME' not found. Skipping deletion."
fi

# --- 2. Remove Project-level IAM Role ---
echo
echo "2. Removing 'roles/ces.client' from '$WEBSOCKET_PROXY_SA_EMAIL'..."
if gcloud projects get-iam-policy "$PROJECT_ID" --flatten="bindings[].members" --format="value(bindings.members)" | grep -q "serviceAccount:${WEBSOCKET_PROXY_SA_EMAIL}"; then
    gcloud projects remove-iam-policy-binding "$PROJECT_ID" \
        --member="serviceAccount:${WEBSOCKET_PROXY_SA_EMAIL}" \
        --role="roles/ces.client" \
        --condition=None \
        --quiet
    echo "   - IAM binding removed successfully."
else
    echo "   - IAM binding for '$WEBSOCKET_PROXY_SA_EMAIL' not found. Skipping removal."
fi

# --- 3. Delete Service Account ---
echo
echo "3. Deleting Service Account '$WEBSOCKET_PROXY_SA_NAME'..."
if gcloud iam service-accounts describe "${WEBSOCKET_PROXY_SA_EMAIL}" --project="$PROJECT_ID" &>/dev/null; then
    gcloud iam service-accounts delete "${WEBSOCKET_PROXY_SA_EMAIL}" \
        --project="$PROJECT_ID" \
        --quiet
    echo "   - Service Account '$WEBSOCKET_PROXY_SA_NAME' deleted."
else
    echo "   - Service Account '$WEBSOCKET_PROXY_SA_NAME' not found. Skipping deletion."
fi

echo
echo "--- Teardown complete! ---"
