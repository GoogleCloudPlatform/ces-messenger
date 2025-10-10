 # Websocket Proxy

This repository contains a websocket proxy server written in Python. It proxies unauthenticated requests coming from the ces-messenger web widget, and adds an access token to authenticate the requests with the CES API. Its primary purpose is to handle authentication and bridge the connection, which is especially useful in environments where direct client-side authentication or connection to Google's services is complex.

It is intended to be used for chat widgets that are configured with audio-enabled (`audio-input-mode` set to anything other than `"NONE"`), that use the Bidirectional Streaming API.

If you have configured your web widget in text-only mode, you need a web based proxy. An implementation of such proxy can be found [here](../web-proxy/).

 ## Overview

 The proxy performs the following functions:

 1.  **Listens for websocket connections** from the ces-messenger web widget.
 2.  **Inspects the initial configuration message** sent by the client.
 3.  **Handles authentication**:
     - If an `accessToken` is present in the config, it's used to connect to the upstream service.
     - If not, it generates an access token, using the service account from the Cloud Run service running the proxy. This service account needs to have the Customer Engagement Suite Client role (`roles/ces.client`) on the project where the agent is deployed.
 4.  **Determines upstream endpoint**: It parses the `session` string from the configuration to determine the correct Google Cloud websocket endpoint.
 5.  **Proxies messages**: It transparently forwards messages between the client and the Google backend in both directions.
 6.  **Handles disconnections**: It manages the lifecycle of both client and remote connections.

 ## Configuration

 The application is configured using environment variables:

 ### Environment Variables

 -   `PROJECT_ID`: (Optional) The GCP Project ID. If not set, it will be inferred from the session string sent by the client.
 -   `REGION`: (Optional) The GCP region where the application will be deployed. Defaults to `us-central1`. To minimize latency, use the same region as the one where your agent is deployed.
 -   `WEBSOCKET_SERVER_PORT`: The local port on which the proxy will listen. Defaults to `8765`.
 -   `TOKEN_TTL`: (Optional) The maximum time to keep using the latest access token. Defaults to 300 seconds (5 minutes).
 -   `OAUTH_SCOPES`: (Optional) The OAuth scopes to use in the access token generation request. Defaults to `https://www.googleapis.com/auth/cloud-platform`.

 ### Usage with CES Messenger

 To use this proxy with the CES Messenger component, set the `api-uri` attribute to the address of your running proxy server.

 ```html
 <ces-messenger
   ...
   api-uri="wss://ces-websocket-proxy-yklfkd2kla-ew.a.run.app"
   ...
 >
 </ces-messenger>
 ```


 ## Running the Proxy

 ### Deployment (e.g., on Google Cloud Run)

 This proxy is well-suited for deployment as a containerized service on platforms like Google Cloud Run.

 1.  **Containerize**: Create a `Dockerfile` to package the application.
 2.  **Service Account**: When deploying, ensure the service has a service account with the **Service Account Token Creator** IAM role, allowing it to generate access tokens for the upstream Google services.
 3.  **Environment Variables**: Configure the necessary environment variables in your Cloud Run service settings.

***Deployment Steps***

 1.  Clone the repository.
 2.  Navigate to the `utils/websocket-proxy` directory.
 3.  Set the `PROJECT_ID` environment variable, and run the `deploy.sh` script:
     ```bash
     export PROJECT_ID="your-gcp-project-id"
     export REGION="europe-west1"

     ./scripts/deploy.sh
     ```

Once the deployment is finished, you will see on your terminal the URL of the Cloud Run service in the Cloud Console and the deployed websocket proxy url. This is the URL that you will need to set in the `api-uri` parameter of the `ces-messenger` web widget.

Example:

```
--- Post-deployment Information ---

   - Console URL: https://console.cloud.google.com/run/detail/europe-west1/ces-websocket-proxy/revisions?project=alpal-aai-prebuilts-6
   - Websocket proxy URL: wss://ces-websocket-proxy-yklfop2kla-ew.a.run.app
```

**Configuring the ces-messenger widget**

To configure the ces-messenger widget so it uses your web proxy, you need to set the `api-uri` parameter with the URL where your proxy is running. Also, you need to configure your agent in audio mode (e.g. `audio-input-mode="DEFAULT_OFF"`) so it uses the Bidirectional Streaming API.

```html
<ces-messenger
    deployment-id="projects/my-project-id/locations/us/apps/2462faec-84d5-41f8-9df5-34a68b2d7dac/deployments/3baf3481-3c57-4d92-a7f0-1ffced3c9e3e"
    chat-title="My agent"
    api-uri="wss://ces-websocket-proxy-yklfop2kla-ew.a.run.app"
    initial-message="hi!"
    theme-id="light"
    audio-input-mode="DEFAULT_OFF"
    modality="chat"
    size="large"
    show-error-messages="true"
></ces-messenger>
```

***Undeployment Steps***

 1.  Clone the repository.
 2.  Navigate to the `utils/websocket-proxy` directory.
 3.  Set the `PROJECT_ID` environment variable, and run the `deploy.sh` script:
     ```bash
     export PROJECT_ID="your-gcp-project-id"
     export REGION="europe-west1"

     ./scripts/undeploy.sh
     ```


## Local development

You can run and test this proxy on your local machine using the Google Cloud Functions Framework.

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

### Running the Proxy

To run the server locally, execute:

```bash
export WEBSOCKET_SERVER_PORT=8765

python main.py
```

The server will start on `0.0.0.0` at the port specified by `WEBSOCKET_SERVER_PORT`.

You can then configure your ces-messenger running on a local web server (e.g. `python3 -m http.server 5173`) using your local web proxy as `api-uri`:

```html
<ces-messenger
    deployment-id="projects/my-project-id/locations/us/apps/2462faec-84d5-41f8-9df5-34a68b2d7dac/deployments/3baf3481-3c57-4d92-a7f0-1ffced3c9e3e"
    chat-title="My agent"
    api-uri="ws://localhost:8765"
    initial-message="hi!"
    theme-id="light"
    audio-input-mode="DEFAULT_OFF"
    modality="chat"
    size="large"
    show-error-messages="true"
></ces-messenger>
```