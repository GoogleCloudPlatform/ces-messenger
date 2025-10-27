# CES Messenger Web Component

`ces-messenger` is a customizable web component that allows you to embed a chat widget for Google's Customer Engagement Suite (CES) Next Generation Agents into your website.

## Integration

To add the `ces-messenger` to your web page, include the component's JavaScript and CSS files in the `<head>` of your HTML document, and then add the `<ces-messenger>` tag to your `<body>`.

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <script src="https://www.gstatic.com/ces-console/fast/ces-messenger/ces-messenger.js"></script>
    <title>My Agent</title>
  </head>
  <body>
    <ces-messenger
      deployment-id="projects/your-project-id/locations/your-location/agents/your-agent-id/deployments/your-deployment-id"
      chat-title="My Awesome Agent"
      token-broker-url="https://your.token.broker/url"
      initial-message="Hello"
      auto-open-chat="true"
      audio-input-mode="DEFAULT_OFF"
    ></ces-messenger>
  </body>
</html>
```

> **Note:** If you want to use your own build of `ces-messenger`, you will need to host the `ces-messenger.js` file on your own CDN or server and replace the `src` path accordingly.

## Component Attributes (Parameters)

You can customize the `ces-messenger` component by setting the following attributes on the `<ces-messenger>` tag.

For a comprehensive list of all available options and their default values, see the detailed [options documentation](doc/options.md).

### General Configuration

| Attribute | Required | Description | Example |
|---|---|---|---|
| `deployment-id` | **Yes** | The deployment ID of the channel created in the console for the web chat | `projects/your-project-id/locations/your-location/agents/your-agent-id/deployments/your-deployment-id` |
| `chat-title` | No | The title displayed at the top of the chat window. | `My Support Agent` |
| `initial-message` | No | A message sent to the agent to start the conversation. This message is not displayed to the user. | `hi` |
| `input-placeholder-text` | No | The placeholder text for the user input field. | `Type your message...` |
| `auto-open-chat` | No | If set to `true`, the chat window will open automatically on page load. | `true` |
| `disable-bubble` | No | If set to `true`, the chat bubble will not show up when the chat is closed. Rely on the `open()` and `close()` functions to show/hide the chat. | `false` |
| `language-code` | No | The language code for the conversation. Defaults to `en-US`. | `es-ES` |
| `disable-image-uploads` | No | Disable the image upload button from the input box. | `true` |
| `enable-debugger` | No | If set to `true`, enables the debugger, which prints detailed logs to the console and exposes them on the `window.cesMessengerLogs` object. | `true` |

### Authentication

| Attribute | Description | Example |
|---|---|---|
| `token-broker-url` | A URL to a service that provides an access token for authentication. This is an alternative to `oauth-client-id`. | `https://your.token.broker/get-token` |
| `api-uri` | The base URI to be used for requests in the case of text-only mode, or a websocket url to be used as websocket proxy for audio sessions. This can be useful if you need to send requests via a proxy to handle authentication or other network considerations. | `https://your-proxy.example.com/` or `wss://your-proxy.example.com/` | |
| `oauth-client-id` | The OAuth 2.0 Client ID for authenticating the end-user. | `your-client-id.apps.googleusercontent.com` |

See the detailed [authentication documentation](doc/authentication.md).

### Audio and Streaming

| Attribute | Description | Values | Default |
|---|---|---|---|
| `audio-input-mode` | Defines how audio input from the user is handled. | `DEFAULT_ON`, `DEFAULT_OFF`, `SPACE_BAR_TO_TALK`, `NONE` | `DEFAULT_ON` |
| `audio-output-mode`| Defines how audio output from the agent is handled. | `ALWAYS_ON`, `DEFAULT_ON`, `DEFAULT_OFF`, `DISABLED` | `ALWAYS_ON` |
| `enable-live-transcription` | If `true`, populates the input field with the live transcript as the user speaks. | `true`, `false` | `false` |
| `voice` | The voice to use for Text-to-Speech. See Google Cloud TTS voices. | `en-US-Standard-C` | `en-US-Chirp3-HD-Aoede` |

### Styling and Appearance

| Attribute | Description | Values | Default |
|---|---|---|---|
| `modality` | The overall style of the widget. `call` mode is a voice-only experience. | `chat`, `call` | `chat` |
| `theme-id` | The color theme for the widget. | `light`, `dark` | `light` |
| `size` | The size of the chat widget. | `small`, `large` | `large` |

### DOM Hints for Agent Context

The messenger includes a "DOM Hints" feature that allows you to provide your agent with real-time contextual information from your webpage's DOM (e.g., shopping cart contents, form data). This gives the agent "eyes" on the page, allowing it to see what the user sees and have more relevant conversations.

For detailed documentation and examples, see [DOM Hints for Agent Context](./doc/dom_hints.md).

## Exposed Functions

You can interact with the `ces-messenger` component programmatically using JavaScript.

First, get a reference to the component:
```javascript
const cesm = document.querySelector('ces-messenger');
```

### `sessionInput(input)`

Sends a text message and/or images to the agent on behalf of the user. `input` can be a string or an object containing a text message (string) an array of images (base64 strings) and a set of variables.


```javascript
window.addEventListener('ces-messenger-connected', () => {
  const cesm = document.querySelector('ces-messenger');

  // Text only input
  cesm.sessionInput("What's the world's tallest tree?");

  // Text and image input
  const images = ["data:image/png;base64,iVBORw0KGgoAAAANSUhEU..."];
  const input = { text: "What kind of tree is this?", images: images};
  cesm.sessionInput(input);

  // Text with variables
  cesm.sessionInput({ text: "Hello", vars: { customer_id: 1234 } });
});
```

### `setQueryParameters(params)`

Sets query parameters to be sent with the next request to the agent. This is useful for passing contextual information.

```javascript
window.addEventListener('ces-messenger-loaded', () => {
  const cesm = document.querySelector('ces-messenger');
  cesm.setQueryParameters({ username: "John Doe", userId: "12345" });
});
```

### `registerClientSideFunction(toolName, callback)`

Registers a client-side function that can be called by the agent as a tool. The callback function will receive the tool arguments as an object.

*Note: use the Integration section in your tool, in the CES console, to get a sample of this code with your tool identifiers already prefilled.*

```javascript
window.addEventListener('ces-messenger-loaded', () => {
  const cesm = document.querySelector('ces-messenger');

  cesm.registerClientSideFunction(
    {
      toolName: 'projects/my-project/locations/us-east1/apps/1234-5678/tools/abcd-efgh',
      toolDisplayName: 'display_picture'
    },
    (args) => {
    Logger.log("Agent wants to display a picture of:", args);
    const pictureHtml = `
      <div>
        <img style="width: 100%" src="${args.url}" />
        <p>${args.caption}</p>
      </div>
    `;
    // Use insertMessage to show custom HTML content
    cesm.insertMessage('BOT', { payload: { html: pictureHtml } });
    return Promise.resolve({ "status": "OK" });
  });
});
```

### `holdToolResponses()`

Pauses the sending of tool responses back to the agent. When a client-side function is executed, its response is normally sent back immediately. Calling this function will queue up any subsequent tool responses until flushToolResponses() is called. This is useful for scenarios where you need to perform an action (like navigating to a new page) before the agent should be notified that the tool has completed.

```javascript
window.addEventListener('ces-messenger-loaded', () => {
    const cesMessenger = document.querySelector('ces-messenger');

    // Register the client-side function
    cesMessenger.registerClientSideFunction(
      {
        toolName: 'projects/my-project-id/locations/us/apps/aa443389-21ab-46e1-9991-cde4cfbe5a4a/tools/596a0e06-3b15-40d6-baa5-e2ff12835ae6',
        toolDisplayName: 'navigate_to_page',
      },
      (args) => {
        const {url} = args;
        cesMessenger.holdToolResponses();
        setTimeout(() => {
          document.location.href = args.url
        }, 100)
        return Promise.resolve({ status: 'success' });
      }
    );
  });
```

### `flushToolResponses()`

Sends any queued tool responses that were held by `holdToolResponses()`. This function is typically not called directly, as navigating away from the page will clear the session. It is useful in specific cases where you need to manually release the held responses.

### `insertMessage(actor, message)`

Inserts a message into the chat history.
*   `actor`: `'USER'` or `'BOT'`
*   `message`: An object containing `text` or a `payload` with `html`.

```javascript
cesm.insertMessage('BOT', { text: 'Here is some information for you.' });

cesm.insertMessage('BOT', { payload: { html: '<b>Important!</b> Read this.' } });
```

### `setAccessToken(token)`

Sets the access token to authenticate with the agent. This can be used if no token broker is configured.

```javascript
const cesm = document.querySelector('ces-messenger');
cesm.setAccessToken('ya29.a0AQQ_BDQ4rxV-bBxjlNAKh...');
```

### `pauseConversation()`

Stops audio recording and playback.

### `disconnectWebStream(reason)`

Disconnects from the agent. The `reason` is optional.

### `endSession()`

Sends a message to the agent to end the current session.

### `clearStorage(args)`

Clears the session storage for the widget, effectively starting a new session on the next page load. If `args.clearAuthentication` is true, it will also sign the user out.

```javascript
const cesm = document.querySelector('ces-messenger');
cesm.clearStorage({ clearAuthentication: true });
```

### `signOut()`

Signs the user out by clearing authentication tokens from local storage.

### `open()`

Programmatically open the chat window.

### `close()`

Programmatically close the chat window.

## Events

The component emits several custom events you can listen for.

### `ces-messenger-loaded`

Fired when the `ces-messenger` component has been fully loaded and its functions are ready to be called.

```javascript
window.addEventListener('ces-messenger-loaded', () => {
  Logger.log('CES Messenger is ready!');
  const cesm = document.querySelector('ces-messenger');
  // You can now call functions on cesm
});
```

### `ces-messenger-connected`

Fired when the connection to the agent has been successfully established.

```javascript
window.addEventListener('ces-messenger-connected', () => {
  Logger.log('Connected to the agent.');
  const cesm = document.querySelector('ces-messenger');
  cesm.sessionInput("I'd like to book a flight.");
});
```

### `ces-messenger-disconnected`

Fired when the connection to the agent is closed. The `event.detail` object contains a `disconnectReason`.

### `ces-authentication-error`

Fired when there is an authentication error.

### `ces-user-input-entered`

Fired when the user sends a text message. The `event.detail` object contains the `input` string.

### `ces-chat-open-changed`

Fired when the chat panel is opened or closed. The `event.detail` object contains `{ isOpen: boolean }`.

### Granular Message Events

For more detailed tracking of the conversation flow, the component emits events for different types of messages being sent and received. The `event.detail` for these events contains the raw message object from the underlying API.

#### Received Messages

*   `ces-message-received`: Fired for any non-audio message received from the agent.
*   `ces-text-received`: Fired when a text message is received.
*   `ces-transcript-received`: Fired when a voice transcript is received.
*   `ces-payload-received`: Fired when a generic payload is received.
*   `ces-tool-call-received`: Fired when the agent calls a client-side tool.

#### Sent Messages

*   `ces-message-sent`: Fired for any message sent to the agent.
*   `ces-text-sent`: Fired when a text message is sent.
*   `ces-image-sent`: Fired when an image is sent.
*   `ces-payload-sent`: Fired when a generic payload is sent.
*   `ces-tool-response-sent`: Fired when a response from a client-side tool is sent back to the agent.

### Subscribing to all events

You can subscribe to all events to get a comprehensive log of the widget's activity.

```javascript
  const subscribedEvents = [
    'ces-messenger-loaded',
    'ces-user-input-entered',
    'ces-chat-open-changed',
    'ces-messenger-connected',
    'ces-messenger-disconnected',
    'ces-authentication-error',
    'ces-message-received',
    'ces-text-received',
    'ces-transcript-received',
    'ces-payload-received',
    'ces-tool-call-received',
    'ces-message-sent',
    'ces-text-sent',
    'ces-image-sent',
    'ces-payload-sent',
    'ces-tool-response-sent'
  ];

  subscribedEvents.forEach((event) => {
    window.addEventListener(event, (e) => {
      console.log(`Event received: ${e.type}. Detail: ${JSON.stringify(e.detail)}`);
    });
  });
```

## Advanced: Callback hooks

### `registerHook('hook-name', callback)`

You can register callbacks for more granular on certain operations in the widget. There are currently two hooks available:

*   `before-chat-panel-close`: Callec before the chat panel is closed. If the callback returns `false`, the closing action is canceled. This is useful for implementing custom confirmation dialogs. See an example in [doc/examples/panel_close_options.html](doc/examples/panel_close_options.html).
*   `response-received`: Called whenever a non-audio message response is received from the agent. The argument is the message object received. This allows to make modifications to the received message, or skip the message altogether. If the callback hook returns `true`, the message processing will continue (with any modifications applied by the callback). If the callback returns `false`, the message will be skipped and no events will be fired about this message.

### Examples

Register a function to be called before the chat panel is closed. 

```javascript
window.addEventListener('ces-messenger-loaded', () => {
  const cesm = document.querySelector('ces-messenger');

  cesm.registerHook('before-chat-panel-close', () => {
    return confirm('Are you sure you want to close the chat?');
  });
});
```

Skip messages containing certain words.

```javascript
window.addEventListener('ces-messenger-loaded', () => {
  const cesm = document.querySelector('ces-messenger');

  cesm.registerHook('response-received', (message) => {
    const bannedWord = 'skipit';

    // Bidi (text+audio) API
    if (message.sessionOutput?.text && message.sessionOutput.text.toLowerCase().includes(bannedWord)) {
      return false;
    }
    // HTTP API (text only)
    if (message.outputs) {
      for (const output of message.outputs) {
        if (output.text && output.text.toLowerCase().includes(bannedWord)) {
          return false;
        }
      }
    }
    return true;
  });
});
```

Skip audio transcripts:

```javascript
window.addEventListener('ces-messenger-loaded', () => {
  const cesm = document.querySelector('ces-messenger');

  cesm.registerHook('response-received', (message) => {
    if (message.recognitionResult) {
      return false;
    }1
    return true;
  });
});
```

## Session management

The ces-messenger component handles session state to provide a persistent experience for the user within a browser session.

  * **Chat History**: User messages and the current session ID are stored in the browser's sessionStorage. This means the conversation history is maintained if the user reloads the page but is cleared when the browser tab is closed. You can manually clear this history by calling `clearStorage()`.
  * **Authentication**: The user's authentication token and its expiration time are stored in the browser's localStorage. This allows the user to remain signed in across different browser tabs and sessions. To clear this, you can call `signOut()`. Alternatively, you can call `clearStorage({ clearAuthentication: true })` to clear both the chat history and the authentication token.
  * **Session ID**: To renew the session ID without clearing the chat history, you can use the `endSession()` function. This will send a signal to the agent to terminate the current session and a new session ID will be generated for subsequent interactions.


## Message templates

`ces-messenger` supports rich, interactive messages through a powerful templating system based on the Handlebars engine. This allows an agent to send not just plain text, but also structured content with interactive elements like buttons, lists, forms, and custom layouts.

The agent can invoke a client-side function to render a specific template with dynamic data. The widget comes with a set of built-in templates for common use cases and also allows you to create and register your own custom templates.

This functionality enables more dynamic and interactive user experiences, where the agent can display complex UI elements directly within the conversation.

For a complete guide on how to use built-in templates, create custom templates, and handle interactions, see the [Rich Message Templates documentation](doc/message_templates.md).

## Examples

### Sending a message when connected

```html
<!-- In your HTML body -->
<ces-messenger
  chat-title="My Agent"
  deployment-id="..."
  token-broker-url="..."
  auto-open-chat="true"
></ces-messenger>

<script>
  window.addEventListener('ces-messenger-connected', () => {
    const cesm = document.querySelector('ces-messenger');
    cesm.sessionInput("What's the world's tallest tree?");
  });
</script>
```

### Setting query parameters on load

```html
<!-- In your HTML body -->
<ces-messenger
  chat-title="My Agent"
  deployment-id="..."
  token-broker-url="..."
></ces-messenger>

<script>
  window.addEventListener('ces-messenger-loaded', () => {
    const cesm = document.querySelector('ces-messenger');
    cesm.setQueryParameters({ username: "JaneDoe", loyalty: "gold" });
  });
</script>
```

### Other examples

See other examples in the [doc/examples](doc/examples) directory. To run these examples locally, edit the `ces-messenger` options to point to your agent and token broker, then navigate to that folder, and launch a local web server:

```
python3 -m http.server 5173
```

Then, with your browser, open http://localhost:5173/.
