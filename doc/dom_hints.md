# DOM Hints for Agent Context

The `ces-messenger` component includes a feature called "DOM Hints," which allows you to provide your agent with real-time contextual information from your webpage's Document Object Model (DOM). This effectively gives the agent "eyes" on the page, allowing it to see what the user sees.

This is incredibly useful for scenarios where the agent's conversation can be enhanced by knowing the state of the UI, such as:

-   The contents of a shopping cart.
-   The values filled into a form.
-   The results displayed in a search list.
-   The content of a product details section.

## How it Works

The DOM Hints functionality is managed by the `DomHintTracker` class. The process is as follows:

1.  **Initialization**: You create a `DomHintTracker` instance by calling the `createDomHintTracker()` method on the `<ces-messenger>` element. You configure it with a variable name and a target DOM element (either via a CSS selector or a direct element reference).

2.  **Tracking**: The tracker is now set up to monitor the specified element.

3.  **Updating**: You call the `tracker.update()` method whenever the content of the tracked element changes. For example, you would call `update()` when a user adds an item to their shopping cart.

4.  **Contextualization**: When `update()` is called, the tracker captures the `innerHTML` of the target element. It then uses the widget's internal `setQueryParameters()` method to stage this HTML content as a variable (e.g., `{ cart_contents: '<div>Item A...</div>' }`).

5.  **Sending to Agent**: This variable is automatically included in the next message sent to the agent, whether it's from user text input, an event, or a programmatic `sessionInput()` call. The agent can then use this information in its turn.

## API Reference

### `cesMessenger.createDomHintTracker(config)`

Creates and returns a new `DomHintTracker` instance.

**`config`** (object): An object containing the configuration for the tracker.

| Key | Type | Optional | Default | Description |
|---|---|---|---|---|
| `varName` | `string` | Yes | `'current_user_html'` | The name of the variable that will be sent to the agent containing the element's HTML. |
| `selector` | `string` | Yes* | `'body'` | The CSS selector for the DOM element to track. Defaults to `'body'` if no `element` is provided. |
| `element` | `HTMLElement` | Yes* | `undefined` | A direct reference to the DOM element to track. This takes precedence over `selector`. |

> *Note: It is recommended to provide either a `selector` or an `element`.
> - If only an `element` is provided, the `selector` is ignored.
> - If neither is provided, the tracker defaults to using the `body` selector.

### `domHintTracker.update(options)`

Captures the current `innerHTML` of the tracked element and sets it as a query parameter for the next agent request.

**`options`** (object, optional): An object to temporarily override the tracker's configuration for a single update.

| Key | Type | Description |
|---|---|---|
| `selector` | `string` | A CSS selector to use for this update only. |
| `element` | `HTMLElement` | A DOM element to use for this update only. |

## Example: Tracking a Shopping Cart

Let's say you have a mini-cart element on your page that updates as the user adds or removes items. You want the agent to be aware of the cart's contents.

First, your HTML might have a custom element for the cart, which contains the list of items.

```html
<!-- This is a simplified example of a cart component -->
<cart-component></cart-component>

<!-- The web widget -->
<ces-messenger
  deployment-id="..."
  chat-title="Cymbal Assistant"
  token-broker-url="..."
></ces-messenger>
```

Next, in your JavaScript, you set up the tracker and tell it to update whenever the cart changes.

```javascript
window.addEventListener('ces-messenger-loaded', async () => {
  const cesMessenger = document.querySelector('ces-messenger');
  
  // Ensure the cart custom element is defined and ready
  await customElements.whenDefined('cart-component');
  const cartComponent = document.querySelector('cart-component');

  // Get a reference to the element inside the cart's shadow DOM that we want to track
  const miniCartElement = cartComponent.shadowRoot.querySelector('#mini-cart-items');

  // 1. Create the DomHintTracker
  const domHintTracker = cesMessenger.createDomHintTracker({
    varName: 'cart_contents', // The agent will receive a variable named 'cart_contents'
    element: miniCartElement  // The element to get HTML from
  });

  // 2. Call update() initially to send the current state
  domHintTracker.update();

  // 3. Set up an event listener to call update() whenever the cart changes
  cartComponent.addEventListener('cart-updated', () => {
    console.log('Cart changed, updating DOM hint for the agent.');
    domHintTracker.update();
  });
});
```

Now, whenever the user adds an item to the cart, the `cart-updated` event fires, `domHintTracker.update()` is called, and the agent will receive the latest `cart_contents` HTML with the user's next message.