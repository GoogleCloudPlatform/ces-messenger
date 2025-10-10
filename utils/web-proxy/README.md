# Authentication Web Proxy

## Overview

This repository contains an authentication web proxy running on Cloud Functions. It proxies unauthenticated requests coming from the ces-messenger web widget, and add them an access token.

It is intended to be used for chat widgets that are configured in text-only mode (`audio-input-mode="NONE"`), since the text-only configuration uses the plain HTTPS request/response API, as opposed to the audio-enabled chats, that use the Bidirectional Streaming API.

If you need an authentication proxy for audio enabled chats, use the [websocket proxy](../websocket-proxy/) instead.

### Key Features

-   **CORS handling**: Includes built-in Cross-Origin Resource Sharing (CORS) handling for both preflight (`OPTIONS`) and main (`GET`) requests, restricted to allowlisted origins.
-   **Dynamic CORS domains**: Reads the allowed domains from the `AUTHORIZED_ORIGINS` environment variable.
-   **Handles authentication**:
     - If an `Authorization` header is present in the request, it's used to connect to the CES API.
     - If not, it generates an access token, using the service account from the Cloud Function running the proxy. This service account needs to have the Customer Engagement Suite Client role (`roles/ces.client`) on the project where the agent is deployed.
-   **Token caching**: Returns the latest refreshed token, if not older that `TOKEN_TTL` (env var) seconds to prevent token API quota errors.

---

## How to Deploy

Follow these steps to deploy the function to your Google Cloud project.

### Prerequisites

1.  **Google Cloud SDK**: Ensure you have `gcloud` installed and authenticated.
2.  **Google Cloud project**: Have a project with the necessary permissions.

### Deployment

This project includes a deployment script to simplify deploying the function. This script will perform the following actions:

1. Create a service account that will be used for running the Cloud Function.

2. Asuming the project where the web proxy is deployed is the same project that hosts the agent, grants the "Customer Engagement Suite Client" role on said project. If you plan to deploy the web proxy on a different project, you will need to grant this permission manually on that project. 

3. Deploys a Cloud FUnction that will serve as web proxy.


**Running the deployment script**

To run the deployment script, you will need to first set two environment variables:

* `PROJECT_ID`: the Google Cloud project ID where you plan to install the web proxy.

* `REGION`: the Google Cloud project ID where you plan to install the web proxy. To minimize latency, use the same region as the one where your agent is deployed.

* `AUTHORIZED_ORIGINS`: the list of authorized domains, separated with semicolons..

Example:

```bash
export PROJECT_ID='your-gcp-project-id'
export REGION='us-central1'
export AUTHORIZED_ORIGINS='https://my-domain.com;https://my-domain-stg.com:3000'

./deploy.sh
```

This script is idempotent. It can be run several times, to reach teh same result.

**Configuring the ces-messenger widget**

To configure the ces-messenger widget so it uses your web proxy, you need to set the `api-uri` parameter with the URL where your proxy is running. Also, you need to configure your agent in text-only mode (`audio-input-mode="NONE"`) so it uses the plain HTTPS request/response API.

```html
<ces-messenger
    deployment-id="projects/my-project-id/locations/us/apps/2462faec-84d5-41f8-9df5-34a68b2d7dac/deployments/3baf3481-3c57-4d92-a7f0-1ffced3c9e3e"
    chat-title="My agent"
    api-uri="https://ces-web-proxy-ykldfp2kla-uc.a.run.app"
    initial-message="hi!"
    theme-id="light"
    audio-input-mode="NONE"
    modality="chat"
    size="large"
    show-error-messages="true"
></ces-messenger>
```

---

**Uninstalling the web proxy**

Similarly, you can uninstall the web proxy using the `undeploy.sh` script.

```bash
export PROJECT_ID='your-gcp-project-id'
export REGION='us-central1'
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

### Running the function

Start the local development server using the Functions Framework:

```bash
functions-framework --target=get_access_token --debug
```

The function will now be running locally, typically at `http://localhost:8080`.

You can then configure your ces-messenger running on a local web server (e.g. `python3 -m http.server 5173`) using your local web proxy as `api-uri`:

```html
<ces-messenger
    deployment-id="projects/my-project-id/locations/us/apps/2462faec-84d5-41f8-9df5-34a68b2d7dac/deployments/3baf3481-3c57-4d92-a7f0-1ffced3c9e3e"
    chat-title="My agent"
    api-uri="http://localhost:8080"
    initial-message="hi!"
    theme-id="light"
    audio-input-mode="NONE"
    modality="chat"
    size="large"
    show-error-messages="true"
></ces-messenger>
```