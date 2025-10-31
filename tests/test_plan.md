### **Test Plan: `<ces-messenger>` Web Component**

**Objective:** To verify the functionality, stability, and usability of the `<ces-messenger>` web component across different configurations, environments, and use cases. This plan covers all public-facing features documented in the component's `README.md`, `options.md`, and other relevant documentation.

---

### **1. Component Initialization and Lifecycle**

This section covers the basic rendering and lifecycle of the component.

| Test Case ID | Description | Preconditions | Steps to Reproduce | Expected Result | Priority | Type |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **TC-INIT-001** | **Default Rendering** | A valid HTML page. | 1. Include the `ces-messenger.js` script. <br> 2. Add `<ces-messenger>` to the body with only the required `deployment-id` and a valid `token-broker-url`. [(test page)](http://localhost:8000/TC-INIT-001_default_rendering.html) | The chat bubble should render in the bottom-right corner with default styles. The chat window should be closed. | High | Unit |
| **TC-INIT-002** | **Initialization with All Attributes** | A valid HTML page. | 1. Include the `ces-messenger.js` script. <br> 2. Add `<ces-messenger>` with all optional attributes set to valid, non-default values. [(test page)](http://localhost:8000/TC-INIT-002_all_attributes.html) | The component should initialize correctly, reflecting all the specified attribute values (e.g., custom title, dark theme, auto-opened). | Medium | Integration |
| **TC-INIT-003** | **Error Handling: Missing `deployment-id`** | A valid HTML page. | 1. Include the `ces-messenger.js` script. <br> 2. Add `<ces-messenger>` to the body *without* the `deployment-id` attribute. [(test page)](http://localhost:8000/TC-INIT-003_missing_deployment-id.html) | The component should fail gracefully. If `show-error-messages` is true, an informative error about the missing required attribute should be displayed in the chat window. No chat bubble should appear. | High | Unit |
| **TC-INIT-004** | **Component Lifecycle: `connectedCallback` & `disconnectedCallback`** | A valid HTML page with the component initialized. | 1. Dynamically add the `<ces-messenger>` element to the DOM. <br> 2. Observe the component. <br> 3. Dynamically remove the component from the DOM. [(test page)](http://localhost:8000/TC-INIT-004_dynamic_add_remove.html) | 1. The component should initialize and render correctly when added. <br> 2. The component should clean up its resources (e.g., event listeners, timers) without errors when removed. | High | Integration |

---

### **2. Attribute and Property Testing**

This section tests each public attribute to ensure it behaves as documented.

#### **2.1 General Configuration**

| Test Case ID | Description | Preconditions | Steps to Reproduce | Expected Result | Priority | Type |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **ATTR-GEN-001** | **`chat-title`** | Component is initialized. | Set the `chat-title` attribute to "My Test Agent". Open the chat window. [(test page)](http://localhost:8000/ATTR-GEN-001_chat-title.html) | The header of the chat window should display "My Test Agent". | High | Unit |
| **ATTR-GEN-002** | **`initial-message`** | Component is initialized and connected to an agent. | Set `initial-message` to "start_promo_flow". [(test page)](http://localhost:8000/ATTR-GEN-002_initial-message.html) | The agent should receive the message "start_promo_flow" as the first turn. The message should not be visible in the user-facing chat history. | High | Integration |
| **ATTR-GEN-003** | **`auto-open-chat`** | Component is initialized. | Set the `auto-open-chat` attribute to `true`. Load the page. [(test page)](http://localhost:8000/ATTR-GEN-003_auto-open-chat.html) | The chat window should open automatically without user interaction. | High | Unit |
| **ATTR-GEN-004** | **`input-placeholder-text`** | Component is initialized. | Set `input-placeholder-text` to "Ask me anything...". Open the chat window. [(test page)](http://localhost:8000/ATTR-GEN-004_input-placeholder-text.html) | The text input field should show "Ask me anything..." as its placeholder. | High | Unit |
| **ATTR-GEN-005** | **`disable-bubble`** | Component is initialized. | Set `disable-bubble` to `true`. Load the page. [(test page)](http://localhost:8000/ATTR-GEN-005_disable-bubble.html) | The chat bubble should not be visible when the chat is closed. The chat window can only be opened programmatically via `open()`. | Medium | Unit |
| **ATTR-GEN-006** | **`language-code`** | Component is initialized. | Set `language-code` to `es-ES`. Start a conversation. [(test page)](http://localhost:8000/ATTR-GEN-006_language-code.html) | The agent should receive `es-ES` as the language code in its requests. If TTS is used, the voice should correspond to that language if not overridden by the `voice` attribute. | High | Integration |

#### **2.2 Authentication**

| Test Case ID | Description | Preconditions | Steps to Reproduce | Expected Result | Priority | Type |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **ATTR-AUTH-001** | **`token-broker-url` (Valid)** | A valid token broker endpoint is available. | Set `token-broker-url` to the valid endpoint. Open the chat. [(test page)](http://localhost:8000/ATTR-AUTH-001_token-broker-url_valid.html) | The component successfully fetches a token and connects to the agent. A conversation can be started. | High | Integration |
| **ATTR-AUTH-002** | **`token-broker-url` (Invalid)** | An invalid or unreachable endpoint. | Set `token-broker-url` to an invalid URL. Open the chat. [(test page)](http://localhost:8000/ATTR-AUTH-002_token-broker-url_invalid.html) | The component fails to connect. An appropriate error message is shown in the chat window (if `show-error-messages` is true). | High | Integration |
| **ATTR-AUTH-003** | **`oauth-client-id`** | A valid OAuth Client ID is configured. | Set `oauth-client-id` to the valid ID. Open the chat. [(test page)](http://localhost:8000/ATTR-AUTH-003_oauth-client-id.html) | A Google Sign-In pop-up appears. After successful authentication, the component connects to the agent. | High | E2E |
| **ATTR-AUTH-004** | **`api-uri` (WebSocket Proxy)** | A WebSocket proxy is set up. `audio-input-mode` is not `NONE`. | Set `api-uri` to the `wss://` proxy URL. Open the chat and start speaking. [(test page)](http://localhost:8000/ATTR-AUTH-004_api-uri_websocket-proxy.html) | All communication should be routed through the WebSocket proxy. The conversation should proceed normally. | High | Integration |
| **ATTR-AUTH-005** | **`api-uri` (HTTP Proxy)** | An HTTP proxy is set up. `audio-input-mode` is `NONE`. | Set `api-uri` to the HTTP proxy URL. Open the chat and send a text message. [(test page)](http://localhost:8000/ATTR-AUTH-005_api-uri_http-proxy.html) | All REST API calls should be routed through the HTTP proxy. The conversation should proceed normally. | High | Integration |

#### **2.3 Audio Configuration**

| Test Case ID | Description | Preconditions | Steps to Reproduce | Expected Result | Priority | Type |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **ATTR-AUDIO-001** | **`audio-input-mode`: `DEFAULT_ON`** | Component initialized. | Set `audio-input-mode="DEFAULT_ON"`. Open chat. [(test page)](http://localhost:8000/ATTR-AUDIO-001_audio-input-mode_default-on.html) | The microphone should be active immediately. Speaking should send audio to the agent. | High | Unit |
| **ATTR-AUDIO-002** | **`audio-input-mode`: `DEFAULT_OFF`** | Component initialized. | Set `audio-input-mode="DEFAULT_OFF"`. Open chat. [(test page)](http://localhost:8000/ATTR-AUDIO-002_audio-input-mode_default-off.html) | A push-to-talk button is visible. Audio is only sent while the button is pressed. | High | Unit |
| **ATTR-AUDIO-003** | **`audio-input-mode`: `SPACE_BAR_TO_TALK`** | Component initialized. | Set `audio-input-mode="SPACE_BAR_TO_TALK"`. Open chat. [(test page)](http://localhost:8000/ATTR-AUDIO-003_audio-input-mode_space-bar-to-talk.html) | Audio is only sent while the spacebar is pressed and the chat widget is not in focus. | Medium | Unit |
| **ATTR-AUDIO-004** | **`audio-input-mode`: `NONE`** | Component initialized. | Set `audio-input-mode="NONE"`. Open chat. [(test page)](http://localhost:8000/ATTR-AUDIO-004_audio-input-mode_none.html) | The microphone button is disabled/hidden. The widget is muted. The experience is text-only. | High | Unit |
| **ATTR-AUDIO-005** | **`audio-output-mode`** | Agent is configured to send audio responses. | Test each value: `ALWAYS_ON`, `DEFAULT_ON`, `DEFAULT_OFF`, `DISABLED`. [(test page)](http://localhost:8000/ATTR-AUDIO-005_audio-output-mode.html) | `ALWAYS_ON`: Audio plays, no mute button. `DEFAULT_ON`: Audio plays, mute button available. `DEFAULT_OFF`: Audio is muted, unmute button available. `DISABLED`: No audio plays, no mute button. | High | Integration |
| **ATTR-AUDIO-006** | **`voice`** | Agent is configured to send audio responses. | Set `voice` to a non-default valid voice (e.g., `en-GB-Standard-A`). [(test page)](http://localhost:8000/ATTR-AUDIO-006_voice.html) | The agent's spoken response should use the specified voice. | High | Integration |

#### **2.4 Styling and Appearance**

| Test Case ID | Description | Preconditions | Steps to Reproduce | Expected Result | Priority | Type |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **ATTR-STYLE-001** | **`modality`: `chat` vs `call`** | Component initialized. | 1. Set `modality="chat"`. <br> 2. Set `modality="call"`. [(test page)](http://localhost:8000/ATTR-STYLE-001_modality.html) | 1. A classic chat window with history is displayed. <br> 2. A smaller, voice-centric widget with no chat history is displayed. | High | Visual |
| **ATTR-STYLE-002** | **`size`: `large` vs `small`** | Component initialized. | 1. Set `size="large"`. <br> 2. Set `size="small"`. [(test page)](http://localhost:8000/ATTR-STYLE-002_size.html) | The chat widget should render in the specified size. | High | Visual |
| **ATTR-STYLE-003** | **`theme-id`: `light` vs `dark`** | Component initialized. | 1. Set `theme-id="light"`. <br> 2. Set `theme-id="dark"`. [(test page)](http://localhost:8000/ATTR-STYLE-003_theme-id.html) | The widget should render with the corresponding light or dark color scheme. | High | Visual |

#### **2.5 Behavior and Image Uploads**

| Test Case ID | Description | Preconditions | Steps to Reproduce | Expected Result | Priority | Type |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **ATTR-BEHV-001** | **`enable-live-transcription`** | `audio-input-mode` is not `NONE`. | Set `enable-live-transcription="true"`. Speak into the microphone. [(test page)](http://localhost:8000/ATTR-BEHV-001_enable-live-transcription.html) | As the user speaks, the live transcription should appear in the text input field. | High | Unit |
| **ATTR-IMG-001** | **`disable-image-uploads`** | Component initialized. | Set `disable-image-uploads="true"`. [(test page)](http://localhost:8000/ATTR-IMG-001_disable-image-uploads.html) | The image upload button in the input area should be hidden. | High | Unit |
| **ATTR-IMG-002** | **`image-upload-max-number`** | Component initialized. | Set `image-upload-max-number="2"`. Attempt to upload 3 images. [(test page)](http://localhost:8000/ATTR-IMG-002_image-upload-max-number.html) | The user should only be able to select and queue up to 2 images. The third should be ignored. | Medium | Unit |
| **ATTR-IMG-003** | **`image-upload-max-width`/`height`** | Component initialized. | Upload an image larger than the default `800x800`. [(test page)](http://localhost:8000/ATTR-IMG-003_image-upload-max-width-height.html) | The image preview in the input bar should show a resized version, and the base64 data sent to the agent should be from the resized image. | Medium | Integration |

---

### **3. Exposed Functions and Events**

This section tests the programmatic API of the component.

| Test Case ID | Description | Preconditions | Steps to Reproduce | Expected Result | Priority | Type |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **API-FUNC-001** | **`sessionInput()` with text** | Component is connected. | Call `cesm.sessionInput("hello world")`. [(test page)](http://localhost:8000/API-FUNC-001_sessionInput_text.html) | The message "hello world" is sent to the agent but not displayed in the chat history. | High | Integration |
| **API-FUNC-002** | **`sessionInput()` with images** | Component is connected. | Call `cesm.sessionInput({ text: "see image", images: ["data:image/png;base64,..."] })`. [(test page)](http://localhost:8000/API-FUNC-002_sessionInput_images.html) | The message and the image are sent to the agent but not displayed in the chat history. | High | Integration |
| **API-FUNC-003** | **`setQueryParameters()`** | Component is loaded. | Call `cesm.setQueryParameters({ userId: "123" })`. Then send a message. [(test page)](http://localhost:8000/API-FUNC-003_setQueryParameters.html) | The next request to the agent should include the specified query parameters. | High | Integration |
| **API-FUNC-004** | **`registerClientSideFunction()`** | Agent is configured to call a tool named `display_picture`. | Use `registerClientSideFunction` to register a handler for `display_picture`. Trigger the tool from the agent. [(test page)](http://localhost:8000/API-FUNC-004_registerClientSideFunction.html) | The registered JavaScript callback should be executed, and receive the arguments sent by the agent. | High | E2E |
| **API-FUNC-005** | **`insertMessage()`** | Component is loaded. | Call `cesm.insertMessage('BOT', { text: 'Hello from client' })`. [(test page)](http://localhost:8000/API-FUNC-005_insertMessage.html) | The message "Hello from client" should appear in the chat history from the bot. | High | Unit |
| **API-FUNC-006** | **`setAccessToken()`** | Component is loaded, no other auth method is configured. | Call `cesm.setAccessToken('valid-token')`. Open the chat. [(test page)](http://localhost:8000/API-FUNC-006_setAccessToken.html) | The component should use the provided token to authenticate and connect successfully. | High | Integration |
| **API-FUNC-007** | **`open()` and `close()`** | Component is loaded. | 1. Call `cesm.open()`. <br> 2. Call `cesm.close()`. [(test page)](http://localhost:8000/API-FUNC-007_open_close.html) | 1. The chat window opens. <br> 2. The chat window closes. | High | Unit |
| **API-EVENT-001** | **Event Emission** | Component is loaded. | Add event listeners for all documented events (e.g., `ces-messenger-loaded`, `ces-messenger-connected`, `ces-user-input-entered`). Perform actions that trigger these events. [(test page)](http://localhost:8000/API-EVENT-001_event_emission.html) | Each event should be fired at the correct time with the correct `event.detail` payload. | High | Integration |
| **API-HOOK-001** | **`registerHook('before-chat-panel-close', ...)`** | Component is loaded. | Register a hook for `before-chat-panel-close` that returns `false`. Click the close button. [(test page)](http://localhost:8000/API-HOOK-001_before-chat-panel-close.html) | The chat panel should remain open. If the hook returns `true`, it should close. | Medium | Unit |
| **API-HOOK-002** | **`registerHook('response-received', ...)`** | Component is connected. | Register a hook for `response-received` that returns `false` if the message contains "skip". Have the agent send "skip this message". [(test page)](http://localhost:8000/API-HOOK-002_response-received.html) | The message should not be rendered in the chat UI. | Medium | Integration |

---

### **4. Advanced Features**

#### **4.1 DOM Hints**

| Test Case ID | Description | Preconditions | Steps to Reproduce | Expected Result | Priority | Type |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **ADV-DOM-001** | **`createDomHintTracker()` and `update()`** | A DOM element with ID `shopping-cart` exists. | 1. Create a tracker: `cesm.createDomHintTracker({ varName: 'cart_contents', selector: '#shopping-cart' })`. <br> 2. Call `tracker.update()`. <br> 3. Send a message to the agent. [(test page)](http://localhost:8000/ADV-DOM-001_createDomHintTracker.html) | The agent should receive a query parameter named `cart_contents` containing the `innerHTML` of the `#shopping-cart` element. | High | Integration |

#### **4.2 Message Templates**

| Test Case ID | Description | Preconditions | Steps to Reproduce | Expected Result | Priority | Type |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **ADV-TPL-001** | **Render Built-in Template** | Agent is configured to send a `cesm_mcq` template payload. | Trigger the agent to send a multi-choice question. [(test page)](http://localhost:8000/ADV-TPL-001_render_builtin_template.html) | The `cesm_mcq` template should render correctly with the provided context (title, options, etc.). | High | Integration |
| **ADV-TPL-002** | **Register and Render Custom Template** | A precompiled custom Handlebars template is available. | 1. Load the precompiled template script. <br> 2. Trigger the agent to send a payload with the custom `template_id`. [(test page)](http://localhost:8000/ADV-TPL-002_register_and_render_custom_template.html) | The custom template should render correctly in the chat window. | Medium | Integration |
| **ADV-TPL-003** | **Rich Message Interaction** | A `cesm_mcq` message is displayed. | Click on one of the options in the rendered `cesm_mcq` message. [(test page)](http://localhost:8000/ADV-TPL-003_rich_message_interaction.html) | The default handler should trigger, sending the corresponding `userMessage` to the agent and deleting the rich message. | High | E2E |
| **ADV-TPL-004** | **`registerRichMessageHandler()`** | A custom template is registered. | Register a custom handler for the template ID using `registerRichMessageHandler`. Click on an element within the rendered template. [(test page)](http://localhost:8000/ADV-TPL-004_registerRichMessageHandler.html) | The custom handler function should be executed. | Medium | Integration |

---

### **5. Styling and Responsiveness**

| Test Case ID | Description | Preconditions | Steps to Reproduce | Expected Result | Priority | Type |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **VIS-RESP-001** | **Responsiveness: Desktop** | Component is rendered on a page. | View the component on a large desktop screen (> 1200px). | The component should be sized appropriately, with no visual glitches or overlapping elements. | High | Visual |
| **VIS-RESP-002** | **Responsiveness: Tablet** | Component is rendered on a page. | View the component on a tablet-sized screen (~768px width). | The component should adapt its layout for the smaller screen without breaking the UI. | High | Visual |
| **VIS-RESP-003** | **Responsiveness: Mobile** | Component is rendered on a page. | View the component on a mobile screen (< 480px width). | The component should take up the full screen, and all interactive elements should be easily tappable. | High | Visual |
| **VIS-A11Y-001** | **Accessibility: Keyboard Navigation** | Chat window is open. | Use the Tab key to navigate through all interactive elements (close button, mute, input, send). | All interactive elements should be focusable and operable using only the keyboard (Tab, Shift+Tab, Enter, Space). | High | A11y |
| **VIS-A11Y-002** | **Accessibility: Screen Readers** | Chat window is open. | Use a screen reader (e.g., NVDA, VoiceOver) to navigate the widget. | All elements should have proper labels (`aria-label`, etc.). Messages should be announced clearly. The user should be able to understand the state and interact with the widget. | High | A11y |