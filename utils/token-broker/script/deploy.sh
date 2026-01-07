#!/bin/bash

ENV_VARS="OAUTH_SCOPES=$OAUTH_SCOPES"

# Add AUTHORIZED_ORIGINS only if it's set and not empty
if [[ -n "${AUTHORIZED_ORIGINS:-}" ]]; then
  ENV_VARS+=",AUTHORIZED_ORIGINS=$AUTHORIZED_ORIGINS"
fi

# Handle ENABLE_LOCAL_SIGNING and Conditional Mount
# Initialize an empty string for the secrets argument
SECRETS_ARG=""

if [[ "${ENABLE_LOCAL_SIGNING:-false}" == "true" ]]; then
  echo "Deploying with Local Sign mode (Mount enabled)..."

  if [[ -z "${SECRET_NAME:-}" ]]; then
    echo "Error: ENABLE_LOCAL_SIGNING is true, but SECRET_NAME is not set."
    echo "Please export SECRET_NAME in your master script."
    exit 1
  fi
  
  # Pass true to the container
  ENV_VARS+=",ENABLE_LOCAL_SIGNING=true"

  # Define mount settings (defaults provided, but can be overridden)
  MOUNT_PATH=${MOUNT_PATH:-"/secrets/token-broker-sa-key"}
  SECRET_NAME=${SECRET_NAME:-"my-secret-name"}
  SECRET_VERSION=${SECRET_VERSION:-"latest"}

  # Construct the secrets flag
  SECRETS_ARG="--set-secrets=$MOUNT_PATH=$SECRET_NAME:$SECRET_VERSION"
else
  echo "Deploying with Standard mode (No mount)..."
  
  # Pass false to the container
  ENV_VARS+=",ENABLE_LOCAL_SIGNING=false"
  SECRETS_ARG="--clear-secrets"
fi

# 3. Deploy
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
    --set-env-vars="$ENV_VARS" \
    $SECRETS_ARG
