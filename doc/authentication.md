# Authentication

All API requests made by the ces-messenger web widget to Google's backend services must be authenticated. This is accomplished using a short-lived OAuth 2.0 access token.

The identity associated with this token, whether it's an end-user or a service account, must have the "Customer Engagement Suite Client" role (`roles/ces.client`) on the project where the agent is deployed.

The ces-messenger web widget offers several methods for handling authentication. In most cases, a token broker is what you will need, but there are other options available to cover other requirements.

## Authentication Options

### 1. Token Broker (Recommended for public-facing Sites)

This is the most flexible method for websites where end-users do not have their own Google identities or should not be prompted to sign in with Google.

*   **Use Case**: Ideal for public-facing websites, support portals, or any application where you want to provide a seamless chat experience to unauthenticated visitors.
*   **How it works**: This approach uses a secure backend service (the "token broker") that provides access tokens to the web component. The broker itself uses a GCP Service Account with the necessary permissions to generate these tokens. This allows your website visitors to interact with the agent without needing their own Google account.
*   **Implementation**: We provide a [reference implementation](../utils/token-broker/README.md) for a token broker architecture using Google Cloud Functions. This setup  generates and returns them to the web widget at the start of a chat session.
*   **Configuration**: Set the `token-broker-url` attribute on the `<ces-messenger>` component.
    ```html
    <ces-messenger
      ...
      token-broker-url="https://your-token-broker-function-url.run.app"
    ></ces-messenger>
    ```
*   **More Info**: For detailed setup instructions, see the [token broker documentation](../utils/token-broker/README.md).

---

### 2. Proxy Server

This option provides the most flexibility for custom authentication scenarios. You route all API communication through your own backend proxy, which is responsible for attaching the authentication token. You can also use this proxy to hide any details about the agent.

*   **Use Case**: Advanced scenarios where you have a custom authentication system or need to manage tokens in a specific way that doesn't fit the other models.
*   **How it works**: The CES Messenger component sends all its requests to your proxy server instead of directly to Google. Your proxy then forwards the requests to the appropriate Google backend, adding the necessary `Authorization` header with a valid access token.
*   **Implementation**:
    *   For **audio-enabled agents** (which use the Bidirectional Streaming API), you will need a **WebSocket proxy**. We provide a [reference implementation](../utils/websocket-proxy/README.md) for this.
    *   For **text-only agents** (which use the standard HTTPS REST API), you can use this [reference implementation](../utils/web-proxy/README.md).
*   **Configuration**: Set the `api-uri` attribute on the `<ces-messenger>` component to the URL of your proxy.
    ```html
    <!-- For an audio/streaming agent -->
    <ces-messenger
      ...
      api-uri="wss://your-websocket-proxy.example.com"
    ></ces-messenger>

    <!-- For a text-only agent -->
    <ces-messenger
      ...
      api-uri="https://your-web-proxy.example.com"
    ></ces-messenger>
    ```
*   **More Info**: For an examples, see the [websocket proxy](../utils/websocket-proxy/README.md) and the [web proxy](../utils/web-proxy/README.md) documentation pages.

---

### 3. OAuth Client ID

This method uses Google's standard OAuth 2.0 flow to authenticate the end-user directly.

*   **Use Case**: Best for internal applications or websites where your users are already authenticated with a Google identity (e.g., employees within your Google Workspace).
*   **How it works**: When the chat widget is opened, the user will be prompted with a Google sign-in pop-up. After they authenticate, an access token is generated on their behalf, which is then used for API requests. This requires that the end-user's Google account has been granted the "Customer Engagement Suite Client" role (`roles/ces.client`) on the project where the agent is deployed.
*   **Implementation**: You must create an **OAuth 2.0 Client ID** in the Google Cloud Console for your web application. Follow the steps in the Google Cloud [Manage OAuth Clients](https://support.google.com/cloud/answer/15549257) documentation. Use the "Web Applications" application type.
*   **Configuration**: Set the `oauth-client-id` attribute on the `<ces-messenger>` component.
    ```html
    <ces-messenger
      ...
      oauth-client-id="your-client-id.apps.googleusercontent.com"
    ></ces-messenger>
    ```

---

### 4. Passing an access token

Set the access token via Javascript using the `setAccessToken(token)` function.

*   **Use Case**: The web page is already authenticated and has a valid GCP access token.
*   **How it works**: Use the `setAccessToken(token)` function to pass a valid token.
*   **Implementation**: In your web page, add a script that sets the access token once the ces-messenger widget has been loaded. Make sure you refresh this token and set it again as needed.

```javascript
window.addEventListener('ces-messenger-loaded', () => {
  const cesm = document.querySelector('ces-messenger');
  cesm.setAccessToken('ya29.a0AQQ_BDQ4rxV-bBxjlNAKh...');
});
```
