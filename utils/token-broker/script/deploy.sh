#!/bin/bash

ENV_VARS="OAUTH_SCOPES=$OAUTH_SCOPES"

# Add AUTHORIZED_ORIGINS only if it's set and not empty
if [[ -n "${AUTHORIZED_ORIGINS:-}" ]]; then
  ENV_VARS+=",AUTHORIZED_ORIGINS=$AUTHORIZED_ORIGINS"
fi

# Add TOKEN_TYPE only if it's set and not empty
if [[ -n "${TOKEN_TYPE:-}" ]]; then
  ENV_VARS+=",TOKEN_TYPE=$TOKEN_TYPE"
fi

if [[ -n "${ALLOW_LOCALHOST:-}" ]]; then
  ENV_VARS+=",ALLOW_LOCALHOST=$ALLOW_LOCALHOST"
fi

if [[ -n "${BROKER_API_KEY:-}" ]]; then
  ENV_VARS+=",BROKER_API_KEY=$BROKER_API_KEY"
fi

AUTH_FLAG="--no-allow-unauthenticated"
if [[ "${ALLOW_UNAUTHENTICATED:-false}" == "true" ]]; then
  AUTH_FLAG="--allow-unauthenticated"
fi

gcloud functions deploy $FUNCTION_NAME \
    --runtime=python312 \
    --gen2 \
    --trigger-http \
    $AUTH_FLAG \
    --service-account=$SERVICE_ACCOUNT \
    --entry-point=$ENTRY_POINT \
    --project=$PROJECT_ID \
    --region=$REGION \
    --min-instances=1 \
    --concurrency=20 \
    --memory=256M \
    --cpu=1 \
    --set-env-vars="$ENV_VARS"
