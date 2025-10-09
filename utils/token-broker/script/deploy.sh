#!/bin/bash

ENV_VARS="OAUTH_SCOPES=$OAUTH_SCOPES"

# Add AUTHORIZED_ORIGINS only if it's set and not empty
if [[ -n "${AUTHORIZED_ORIGINS:-}" ]]; then
  ENV_VARS+=",AUTHORIZED_ORIGINS=$AUTHORIZED_ORIGINS"
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
