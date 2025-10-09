# ces-messenger Web Component Options

This document outlines the available attributes (options) for the `ces-messenger` web component.

## General Configuration

### `deployment-id`

**Required**. The deployment ID of the channel created in the console for the web chat.

**Example:** `projects/your-project-id/locations/your-location/agents/your-agent-id/deployments/your-deployment-id`

### `chat-title`

*Optional*. Text to display at the top of the chat window as its title. This is usually the name of your agent or service.

### `initial-message`

*Optional*. The first message that is sent to the virtual agent as the user's greeting. It is recommended to use this because otherwise the agent won't say anything until the user does. This message is not displayed to the user; only the agent sees it. This can also be used to pass configuration parameters.

### `auto-open-chat`

*Optional*. A boolean attribute. If present, the chat window will automatically open the first time the widget is loaded.

### `input-placeholder-text`

*Optional*. The placeholder text for the user input field.
*   **Default**: `What do you need help with?`

## Authentication Options

You must specify at least one of the following options for authentication to happen.

### `token-broker-url`

If specified, this URL is called with a GET request to obtain a token that will be used to authenticate against the agent. If both `token-broker-url` and `oauth-client-id` are provided, `token-broker-url` will take precedence.

### `api-uri`

*Optional*. The API endpoint URI for the bidi stream. Can be a WebSocket URL (`ws://` or `wss://`).

### `oauth-client-id`

If specified, this OAuth client ID will be used to authenticate the end-user and get a token, which will then be used to authenticate against the agent. This requires setting up an OAuth client in the Google Cloud Console.

See the detailed authentication documentation [here](authentication.md).

## Audio configuration

### `audio-input-mode`

*Optional*. Defines how audio input is handled.
*   **Values**:
    *   `DEFAULT_ON`: The microphone is always open and recording.
    *   `DEFAULT_OFF`: The user needs to press and hold a button for the microphone to record.
    *   `SPACE_BAR_TO_TALK`: The user needs to press and hold the spacebar (while the chat widget is not in focus) for the microphone to record.
    *   `NONE`: The microphone is disabled for a text-only chat experience. This option also mutes the widget, so no audio from agent responses will be played.
*   **Default**: `DEFAULT_ON`

### `audio-output-mode`

*Optional*. Defines how audio output is handled.
*   **Values**:
    *   `ALWAYS_ON`: The agent's voice will always play.
    *   `DEFAULT_ON`: The agent's voice will play by default, but a mute button is available.
    *   `DEFAULT_OFF`: The agent's voice is muted by default, but an unmute button is available.
    *   `DISABLED`: The agent's voice is completely disabled.
*   **Default**: `DEFAULT_ON`

### `voice`

*Optional*. The voice to be used for Text-to-Speech.
*   **Default**: `en-US-Chirp3-HD-Aoede`
*   **See also**: [Supported voices and languages](https://cloud.google.com/text-to-speech/docs/list-voices-and-types)

## Styling and Appearance

### `bidi-style-id`

*Optional*. Determines the style of the widget.
*   **Values**:
    *   `chat`: A classic chat window is displayed. This option supports both text and audio-based chat, which can be configured with `audio-input-mode`.
    *   `call`: A pure voice experience with a smaller widget and no full chat history. This is not compatible with the `NONE` audio mode.
*   **Default**: `chat`

### `bidi-size`

*Optional*. The size of the widget.
*   **Values**: `large` | `small`
*   **Default**: `large`

### `bidi-theme-id`

*Optional*. The theme to use for the web component widget.
*   **Values**: `light` | `dark`
*   **Default**: `light`

## Behavior

### `enable-live-transcription`

*Optional*. A boolean attribute. If set to `true`, the user input field will be populated with the live transcription as the user speaks.
*   **Default**: `false`

### `language-code`

*Optional*. The language code for the conversation.
*   **Default**: `en-US`
*   **See also**: [Supported voices and languages](https://cloud.google.com/text-to-speech/docs/list-voices-and-types)

## Image upload options

### `disable-image-uploads`

*Optional*. Disable the image upload button from the input box.
*   **Default**: `false`

### `image-upload-max-number`

*Optional*. The maximum number of images that can be uploaded at once.
*   **Default**: `4`

### `image-upload-max-width`

*Optional*. The maximum width (in pixels) to which an uploaded image will be resized.
*   **Default**: `800`

### `image-upload-max-height`

*Optional*. The maximum height (in pixels) to which an uploaded image will be resized.
*   **Default**: `800`

## Debugging options

### `show-error-messages`

*Optional*. A boolean attribute. If set to `true`, displays detailed error messages in the chat window for debugging purposes.
*   **Default**: `false`

### `enable-debugger`

*Optional*. A boolean attribute. If set to `true`, it enables a debug mode that prints detailed logs to the browser console. These logs are also available on the `window.cesMessengerLogs` object for programmatic access.
*   **Default**: `false`
