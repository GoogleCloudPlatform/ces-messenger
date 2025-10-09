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

# These values must match the ones used in deploy.sh to target the correct resources.
REGION="us-central1"
TOKEN_BROKER_SA_NAME="ces-token-broker"
FUNCTION_NAME="ces-token-broker"

# Construct full SA email address
TOKEN_BROKER_SA_EMAIL="${TOKEN_BROKER_SA_NAME}@${PROJECT_ID}.iam.gserviceaccount.com"

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
echo "2. Removing 'roles/ces.client' from '$TOKEN_BROKER_SA_EMAIL'..."
if gcloud projects get-iam-policy "$PROJECT_ID" --format=json | grep -q "serviceAccount:${TOKEN_BROKER_SA_EMAIL}"; then
    gcloud projects remove-iam-policy-binding "$PROJECT_ID" \
        --member="serviceAccount:${TOKEN_BROKER_SA_EMAIL}" \
        --role="roles/ces.client" \
        --condition=None \
        --quiet
    echo "   - IAM binding removed successfully."
else
    echo "   - IAM binding for '$TOKEN_BROKER_SA_EMAIL' not found. Skipping removal."
fi

# --- 3. Delete Service Account ---
echo
echo "3. Deleting Service Account '$TOKEN_BROKER_SA_NAME'..."
if gcloud iam service-accounts describe "${TOKEN_BROKER_SA_EMAIL}" --project="$PROJECT_ID" &>/dev/null; then
    gcloud iam service-accounts delete "${TOKEN_BROKER_SA_EMAIL}" \
        --project="$PROJECT_ID" \
        --quiet
    echo "   - Service Account '$TOKEN_BROKER_SA_NAME' deleted."
else
    echo "   - Service Account '$TOKEN_BROKER_SA_NAME' not found. Skipping deletion."
fi

echo
echo "--- Teardown complete! ---"