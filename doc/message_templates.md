# Rich Message Templates

The `ces-messenger` component supports rich, interactive messages through a powerful templating system. This allows an agent to send not just plain text, but also structured content with interactive elements like buttons, lists and custom layouts.

This system is built upon two core concepts:

1.  **Handlebars**: A popular and robust templating engine.
2.  **Client Functions**: A mechanism for the agent to invoke functions on the client-side (in the browser).

## How it Works

The process for displaying a rich message is straightforward:

1.  The agent determines that a rich message needs to be displayed.
2.  It invokes a special Client Function, providing a `template_id` and a `context` object. The `context` contains the data to be rendered in the template. Optionally, two other arguments can be used in the function `content_type` and `render_options`. See below fore more details.
3.  The `ces-messenger` widget automatically detects this specific function call. It looks for a registered template matching the `template_id`.
4.  If a matching template is found, the widget uses Handlebars to combine the template with the provided `context` data.
5.  The resulting HTML is then rendered as a new message in the chat history.

This approach allows for dynamic and interactive user experiences, where the agent can display complex UI elements within the conversation.

## Client Function arguments

The client function call can contain the following arguments:

* `template_id` (required): the ID of the template to render.
* `context` (required): the data to be rendered in the template.
* `content_type` (optional): an identifier of the type of content that is being rendered. This is specific to the agent (e.g. `product_list`), and it allows to handle user differently interactions on messages using the same template, but different content types.
* `render_options` (optional): an object that allows to override the action returned by the `richTextMessageHandler`. This allows, for example to choose not to delete the message after it has been clicked on, even if the handler returns `delete`.

See below a function call with all the arguments:

```json
{
  "type": "TOOL_CALL",
  "toolCall": {
    "id": "adk-1a5dcfd4-d663-44e6-ab43-7e5fe94b08ee",
    "tool": "projects/my-project-id/locations/us/apps/7c789279-3909-4ffe-bd28-3b022c67993c/tools/497a6860-6d4c-44c1-8e3c-86b88a933664",
    "args": {
      "content_type": "demo_list",
      "render_options": {
        "onclick": "keep"
      },
      "context": {
        "agentMessage": "Here are the demos that I have for you. Please, choose one:",
        "options": [
          {
            "title": "Multiple choice question",
            "userMessage": "show me the the demo with ID \"mcq_demo\""
          },
          {
            "userMessage": "show me the the demo with ID \"button_demo\"",
            "title": "Button"
          },
          {
            "userMessage": "show me the the demo with ID \"custom_demo\"",
            "title": "Custom template"
          }
        ]
      },
      "template_id": "cesm_mcq"
    },
    "displayName": "template_filler"
  }
}
```

## Built-in Templates

`ces-messenger` comes with a set of pre-defined templates for common use cases, such as displaying buttons, lists, and cards. These templates are located in the `src/templates` directory of the source code and are available automatically without any client-side configuration.

To use a built-in template, the agent simply needs to call the template-rendering client function with the appropriate `template_id` (e.g., `cesm_button`) and a corresponding `context` object.

## Custom Templates

You can extend the functionality by creating and registering your own custom templates. This is useful for displaying application-specific data or creating unique interactive components.

There are two ways to provide custom templates: raw or precompiled.

### 1. Raw Templates (for Development)

You can load a raw Handlebars template string (`.hbs` file) and register it at runtime. This method is convenient for development and testing, but it is **not recommended for production** because it requires including the full Handlebars compiler in your web page, which impacts performance and may conflict with strict Content Security Policies (CSP).

To register a raw template, you use the `registerTemplate()` method on the `<ces-messenger>` element.

```html
<!-- You must include the full Handlebars library -->
<script src="https://cdn.jsdelivr.net/npm/handlebars@latest/dist/handlebars.js"></script>
<script>
  window.addEventListener('ces-messenger-loaded', () => {
    const cesMessenger = document.querySelector('ces-messenger');

    // Fetch the raw template content
    fetch('./resources/my_custom_template.hbs')
      .then((response) => response.text())
      .then((templateString) => {
        // Compile the template using the Handlebars library
        const template = Handlebars.compile(templateString);

        // Register the compiled template function with the widget
        cesMessenger.registerTemplate('my_template_id', template);
      });
  });
</script>
```

### 2. Precompiled Templates (Recommended for Production)

For production environments, the best practice is to use precompiled templates. Precompiling your Handlebars templates into JavaScript files offers several advantages:

-   **Better Performance**: Templates are parsed and compiled at build time, not in the user's browser.
-   **Smaller Footprint**: You don't need to ship the full Handlebars compiler to your users.
-   **Enhanced Security**: Avoids the use of `eval()` or `new Function()`, making your application compatible with stricter CSPs.

You can precompile templates using the Handlebars CLI. The output is a JavaScript file that, when loaded, automatically registers the template functions with the Handlebars runtime. You just need to load this script in your page.

```html
<!--
  Load the precompiled templates script.
  This can be done via a standard script tag or loaded dynamically.
-->
<script>
  window.addEventListener('ces-messenger-loaded', () => {
    // Dynamically load the custom_templates.js script
    const script = document.createElement('script');
    script.src = './resources/custom_templates.js';
    document.head.appendChild(script);
  });
</script>
```

## Handling Rich Message Interactions

`ces-messenger` provides a way to handle user interactions on your rich message templates. This is particularly useful for creating interactive elements that trigger client-side actions when clicked.

The primary method for this is `registerRichMessageHandler()`. This function allows you to register a callback that will be executed when a user interacts with a specific part of a rendered template.

### `registerRichMessageHandler()`

You can register a handler for a specific template ID. When an element inside that template is clicked, your handler function will be invoked.


Inside the handler, you have access to the original `message` object and the `clickedElement` that triggered the event. You can then perform any client-side logic, such as sending a message to the agent or modifying the UI.

The handler can also return an object to control the behavior of the message after the interaction. For example, returning `{ action: 'delete' }` will remove the message from the chat history.

You can register a handler for your template in the following way:

```javascript
window.addEventListener('ces-messenger-loaded', () => {
  const cesMessenger = document.querySelector('ces-messenger');

  // Register a handler for a template with the ID 'order_details'
  cesMessenger.registerRichMessageHandler(
    'order_details',
    (message, clickedElement) => {
      console.log('A user clicked on the order details template!');
      console.log('Message object:', message);
      console.log('Clicked element:', clickedElement);

      // After interaction, remove the message from the chat history
      return { action: 'delete' };
    }
  );
});
```

A more advanced example, when we identify the element that has been clicked, can be found in the default `cesm_mcq` template:

```javascript
function listTemplateHandler(message, clickedElement) {
  const context = message.payload?.context;
  const optionItem = clickedElement.closest('.option-item');

  if (optionItem && context) {
    const index = optionItem.dataset.index;
    const selectedOption = context.options[index];
    if (selectedOption) {
      const messageToSend = selectedOption.userMessage || selectedOption.title;
      // Add the message to the chat history
      insertMessage('USER', { text: messageToSend });
      // Send the message to the agent
      sessionInput(messageToSend);
    }
  }
  // Remove the original rich text message from the chat history
  return { action: 'delete'}
}
```

The handler extracts the context that was used to fill the template. It also uses the `clickedElement` to find the DOM ID of the element. That ID was added in the template:

```html
{{#if agentMessage}}{{agentMessage}}{{/if}}
<div class="cesm-mcq">
  {{#if header}}
  <div class="mcq-header mcq-title">{{header}}</div>
  {{/if}}
  <div class="options-list">
    {{#each options}}
    <div class="card option-item" data-index="{{@index}}"
      {{#if this.onclick}}
        onclick="{{this.onclick}}"
      {{/if}}
      > 
      <div class="option-info">
        {{#if this.image}}
        <div class="option-image" style="background-image: url(&quot;{{this.image}}&quot;);"></div>
        {{/if}}
        <div class="option-details">
          <p class="option-title">{{this.title}}</p>
          {{#if this.subtitle}}
          <p class="option-subtitle">{{this.subtitle}}</p>
          {{/if}}
        </div>
      </div>
    </div>
    {{/each}}
  </div>
</div>
```

Then, it gets the information of the option that was clicked from the context:

```json
{
  "agentMessage": "Here are the demos that I have for you. Please, choose one:",
  "options": [
    {
      "title": "Multiple choice question",
      "userMessage": "show me the the demo with ID \"mcq_demo\""
    },
    {
      "title": "Button",
      "userMessage": "show me the the demo with ID \"button_demo\""
    },
    {
      "title": "Custom template",
      "userMessage": "show me the the demo with ID \"custom_demo\""
    }
  ]
}
```

The full signature of the `registerRichMessageHandler()` function is:

```javascript
registerRichMessageHandler(templateId, handler, contentType=undefined, eventName='click')
```

This allows you to register a handler for any message with a given `templateId`, or be more specific and only register it for messages of a given `contentType`. When looking for the handler, the most specific match will apply.

The `eventName` allows to register handlers for different types of events, although currently, only 'click' is supported.

## Overriding Template Context

In some scenarios, you may need to modify the `context` data sent by the agent before it gets rendered. For example, you might want to format a date, translate text, or attach a client-side JavaScript function to a button's `onclick` event.

You can achieve this by registering a client-side function that intercepts the template rendering call. If the `ces-messenger` widget sees a registered function for the tool that is supposed to render a template, it will execute your function instead of performing the default template rendering.

Inside your function, you can modify the `context` object as needed and then manually trigger the rendering using the `insertRichMessage(template_id, context)` method.

```javascript
window.addEventListener('ces-messenger-loaded', () => {
  const cesMessenger = document.querySelector('ces-messenger');

  // Register a function to intercept calls for a specific tool
  cesMessenger.registerClientSideFunction(
    {
      toolDisplayName: 'template_filler' // The display name of the tool defined in the agent
    },
    (args) => {
      // args contains { template_id, context }
      if (args.template_id === 'cesm_button' && args.context) {
        // Modify the context data
        args.context.text = 'Button text modified on the client!';
        args.context.onclick = 'window.alert("This handler was added by the client!")';
      }

      // Manually render the message with the modified context
      cesMessenger.insertRichMessage(args.template_id, args.context);

      // Return a success status to the agent
      return Promise.resolve({status: 'success'});
    },
  );
});
```

## Examples

The `doc/examples` folder contains working examples that demonstrate these concepts:

-   **Raw Custom Template (`message_template_raw.html`)**: Shows how to load a `.hbs` file, compile it in the browser, and register it with the widget. This is a good starting point for development.

-   **Precompiled Custom Template (`message_template_precompiled.html`)**: Illustrates the recommended production approach of using precompiled Handlebars templates for improved performance and security.

-   **Overriding Template Context (`message_template_override.html`)**: Demonstrates how to register a client-side function to intercept a template call, modify its context data on the fly, and then render the message.

## API Reference

The following `<ces-messenger>` methods are used for template functionality:

-   `registerTemplate(templateId: string, templateFunction: Function)`: Registers a custom template (either raw-compiled or precompiled) with the widget.
-   `registerClientSideFunction(tool: { toolName?: string, toolDisplayName?: string }, handler: Function)`: Registers a handler function for a specific agent tool. This can be used to intercept template rendering.
-   `registerRichMessageHandler(templateId: string, handler: (message: object, clickedElement: HTMLElement) => { action: 'delete' | undefined })`: Registers a click handler for a rendered rich text message.
-   `insertRichMessage(templateId: string, context: object)`: Programmatically inserts a rich message into the chat history by rendering the specified template with the given context.
