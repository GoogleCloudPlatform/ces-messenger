/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { Logger } from '@/logger.js';

class CustomButtonElement extends HTMLElement {
  static get observedAttributes() {
    return ['button-text', 'button-style', 'onclick-listener'];
  }

  // Store default styles in a static property for easy access.
  static defaultCss = `
            div {
                display: flex;
                justify-content: center;
            }
            div.hidden {
                display: none
            }
            button {
                margin-bottom: 5em;
                border-radius: 10px;
                border: 1px solid #ddd;
                padding: 20px;
                font-size: 16px;
                background-size: 32px;
                background-repeat: no-repeat;
                background-position-x: 20px;
                background-position-y: 50%;
                background-color: #fff;
                color: #666666;
                font-family: 'Google Sans';
                cursor: pointer;
            }
            button:hover {
                background-color: #eee; 
            }`;

  constructor() {
    super();
    this.attachShadow({ mode: 'open' });

    this._button = null;
    this._styleElement = null;
    this._onClickFunctionName = null;
  }

  connectedCallback() {
    let buttonDiv = document.createElement('div');
    this._button = document.createElement('button');
    this._styleElement = document.createElement('style');
    this._styleElement.textContent = this.buttonStyle;
    buttonDiv.appendChild(this._button);
    this.shadowRoot.appendChild(this._styleElement);
    this.shadowRoot.appendChild(buttonDiv);
    this._updateText();
    this._updateStyle();
    this._updateOnClick();
    this._button.addEventListener('click', () => this._handleClick());
  }

  attributeChangedCallback(name, oldValue, newValue) {
    if (oldValue === newValue) {
      return;
    }

    switch (name) {
    case 'button-text':
      this._updateText();
      break;
    case 'button-style':
    case 'onclick-listener':
      this._updateOnClick();
      break;
    }
  }

  _updateStyle() {
    if (!this._styleElement) return;

    const replaceStyle = this.getAttribute('button-style');

    let baseCss = CustomButtonElement.defaultCss;

    if (replaceStyle) {
      baseCss = replaceStyle;
    }

    this._styleElement.textContent = baseCss;
  }

  _handleClick() {
    if (
      this._onClickFunctionName &&
      typeof window.kite[this._onClickFunctionName] === 'function'
    ) {
      window.kite[this._onClickFunctionName](this);
    } else if (this._onClickFunctionName) {
      Logger.warn(
        `The function "${this._onClickFunctionName}" was not found on the window object.`
      );
    }
  }

  _updateText() {
    if (this._button) {
      const text = this.getAttribute('button-text') || 'Default Text';
      this._button.textContent = text;
    }
  }

  _updateOnClick() {
    this._onClickFunctionName = this.getAttribute('onclick-listener');
  }
}

export { CustomButtonElement };
