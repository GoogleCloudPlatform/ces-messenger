# Access Token Broker

## Overview

This repository contains a Google Cloud Function designed to return service account access tokens. It is intended to be used with the ces-messenger web component to allow unauthenticated users access CES aggents.

### Key Features

-   **CORS Handling**: Includes built-in Cross-Origin Resource Sharing (CORS) handling for both preflight (`OPTIONS`) and main (`GET`) requests, restricted to allowlisted origins.
-   **Dynamic CORS domains**: Reads the allowed domains from the `AUTHORIZED_ORIGINS` environment variable.
-   **Token caching**: Returns the latest refreshed token, if not older that `TOKEN_TTL` (env var) seconds to prevent token API quota errors.

---

## How to Deploy

Follow these steps to deploy the function to your Google Cloud project.

### Prerequisites

1.  **Google Cloud SDK**: Ensure you have `gcloud` installed and authenticated.
2.  **Google Cloud Project**: Have a project with the necessary permissions.

### Deployment

This project includes a deployment script to simplify deploying the function. This script will perform the following actions:

1. Create a service account that will be used for running the Cloud Function.

2. Asuming the project where the token broker is deployed is the same project that hosts the agent, grants the "Customer Engagement Suite Client" role on said project. If you plan to deploy the token broker on a different project, you will need to grant this permission manually on that project. 

3. Deploys a Cloud FUnction that will serve as token broker.


**Running the deployment script**

To run the deployment script, you will need to first set two environment variables:

* `PROJECT_ID`: the Google Cloud project ID where you plan to install the token broker.

* `AUTHORIZED_ORIGINS`: the list of authorized domains, separated with semicolons. E.g. ``.

Example:

```bash
export PROJECT_ID='your-gcp-project-id'
export REGION="europe-west1"
export AUTHORIZED_ORIGINS='https://my-domain.com;https://my-domain-stg.com:3000'

./deploy.sh
```

This script is idempotent. It can be run several times, to reach teh same result.

**Configuring the ces-messenger widget**

To configure the ces-messenger widget so it uses your token broker, you need to set the `token-broker-url` parameter with the URL where your token broker is running. Example:

```html
<ces-messenger
    deployment-id="projects/my-project-id/locations/us/apps/2462faec-84d5-41f8-9df5-34a68b2d7dac/deployments/3baf3481-3c57-4d92-a7f0-1ffced3c9e3e"
    chat-title="My agent"
    token-broker-url="https://ces-token-broker-yklfop2kla-ew.a.run.app"
    initial-message="hi!"
    bidi-theme-id="light"
    audio-input-mode="DEFAULT_OFF"
    bidi-style-id="chat"
    bidi-size="large"
    show-error-messages=true
></ces-messenger>
```

---

**Uninstalling the token broker**

Similarly, you can uninstall the token broker using the `undeploy.sh` script.

```bash
export PROJECT_ID='your-gcp-project-id'
export REGION="europe-west1"

./undeploy.sh
```

## Local development

You can run and test this function on your local machine using the Google Cloud Functions Framework.

### Prerequisites

-   Python 3.12
-   `pip` and `venv`

### Setup

1.  **Clone the repository:**
    ```bash
    git clone <repository-url>
    cd <repository-directory>
    ```

2.  **Create and activate a Python virtual environment:**
    ```bash
    python3 -m venv .venv
    source .venv/bin/activate
    ```

3.  **Install dependencies:**
    A `requirements.txt` file is included.
    ```bash
    pip install -r requirements.txt
    ```

4.  **Authenticate with Google Cloud:**
    This command sets up Application Default Credentials, which the client library will automatically use.
    ```bash
    gcloud auth application-default login
    ```

5.  **Set the environment variable:**
    In your terminal, set the `AUTHORIZED_ORIGINS`.
    ```bash
    export AUTHORIZED_ORIGINS='https://my-domain.com;https://my-domain-stg.com:3000'
    ```

### Running the Function

Start the local development server using the Functions Framework:

```bash
functions-framework --target=get_access_token --debug
```

The function will now be running locally, typically at `http://localhost:8080`.

### Testing Locally

You can use `curl` to test the endpoint.

**Test the main GET endpoint:**
(Replace `http://localhost:5173` with one of the origins authorized in `main.py`)

```bash
curl -i -X GET http://localhost:8080 \
  -H "Origin: http://localhost:5173"
```

You should receive a `200 OK` response with a JSON payload and the `Access-Control-Allow-Origin` header.

**Test a CORS preflight request:**

```bash
curl -i -X OPTIONS http://localhost:8080 \
  -H "Origin: http://localhost:5173" \
  -H "Access-Control-Request-Method: GET" \
  -H "Access-Control-Request-Headers: Content-Type"
```

You should receive a `204 No Content` response with the appropriate `Access-Control-*` headers.
