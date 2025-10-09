#!/bin/bash
set -e # Exit immediately if a command exits with a non-zero status.
set -u # Treat unset variables as an error when substituting.
set -o pipefail # Pipeline's return status is the value of the last command to exit with a non-zero status.

# --- Configuration ---
# Take the target region from the REGION env var, or default to us-central1 if not set.
REGION="${REGION:-us-central1}"

# This script requires the PROJECT_ID environment variable to be set.
if [[ -z "${PROJECT_ID:-}" ]]; then
  echo "Error: PROJECT_ID environment variable is not set."
  echo "Please set it before running the script, e.g.:"
  echo "export PROJECT_ID='your-gcp-project-id'"
  exit 1
fi

WEB_PROXY_SA_NAME="ces-web-proxy"
FUNCTION_NAME="ces-web-proxy"

# Construct full SA email address
WEB_PROXY_SA_EMAIL="${WEB_PROXY_SA_NAME}@${PROJECT_ID}.iam.gserviceaccount.com"

echo "--- Starting teardown for project: $PROJECT_ID ---"

# --- 1. Delete Cloud Function ---
echo
echo "1. Deleting Cloud Function '$FUNCTION_NAME'..."
if gcloud functions describe "$FUNCTION_NAME" --region "$REGION" --project "$PROJECT_ID" &>/dev/null; then
    gcloud functions delete "$FUNCTION_NAME" \
        --region "$REGION" \
        --project "$PROJECT_ID" \
        --quiet
    echo "   - Cloud Function '$FUNCTION_NAME' deleted."
else
    echo "   - Cloud Function '$FUNCTION_NAME' not found. Skipping deletion."
fi

# --- 2. Remove Project-level IAM Role ---
echo
echo "2. Removing 'roles/ces.client' from '$WEB_PROXY_SA_EMAIL'..."
if gcloud projects get-iam-policy "$PROJECT_ID" --format=json | grep -q "serviceAccount:${WEB_PROXY_SA_EMAIL}"; then
    gcloud projects remove-iam-policy-binding "$PROJECT_ID" \
        --member="serviceAccount:${WEB_PROXY_SA_EMAIL}" \
        --role="roles/ces.client" \
        --condition=None \
        --quiet
    echo "   - IAM binding removed successfully."
else
    echo "   - IAM binding for '$WEB_PROXY_SA_EMAIL' not found. Skipping removal."
fi

# --- 3. Delete Service Account ---
echo
echo "3. Deleting Service Account '$WEB_PROXY_SA_NAME'..."
if gcloud iam service-accounts describe "${WEB_PROXY_SA_EMAIL}" --project="$PROJECT_ID" &>/dev/null; then
    gcloud iam service-accounts delete "${WEB_PROXY_SA_EMAIL}" \
        --project="$PROJECT_ID" \
        --quiet
    echo "   - Service Account '$WEB_PROXY_SA_NAME' deleted."
else
    echo "   - Service Account '$WEB_PROXY_SA_NAME' not found. Skipping deletion."
fi

echo
echo "--- Teardown complete! ---"