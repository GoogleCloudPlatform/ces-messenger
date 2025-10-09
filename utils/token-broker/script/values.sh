#!/bin/bash
PROJECT_ID=my-project-id
REGION=us-central1
OAUTH_SCOPES="https://www.googleapis.com/auth/cloud-platform"
FUNCTION_NAME="token-broker-function"
ENTRY_POINT="get_access_token" # The name of the Python function to execute.
SERVICE_ACCOUNT=access-token-broker@my-project-id.iam.gserviceaccount.com
