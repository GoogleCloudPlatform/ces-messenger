/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { CustomButtonElement } from '@/custom-elements.js';

async function googleLogin(callback, clientId) {
  // eslint-disable-next-line no-undef
  google.accounts.oauth2.initTokenClient({
    client_id: clientId,
    //scope: 'https://www.googleapis.com/auth/ces https://www.googleapis.com/auth/dialogflow',
    scope: 'https://www.googleapis.com/auth/cloud-platform',
    callback: callback
  }).requestAccessToken();
}

function getAuthButtonHtml(oauthClientId) {
  let authButtonText = 'Please, sign-in';
  let customStyle = '';
  if (oauthClientId?.includes('apps.googleusercontent.com')) {
    authButtonText = 'Sign-in with Google';
    customStyle = `button-style="div {
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
                padding: 15px;
                font-size: 16px;
                background-image: url('https://www.google.com/images/branding/googleg/1x/googleg_standard_color_128dp.png');
                padding-left: 65px;
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
            }"`;
  }

  // define the `auth-button` custom element only if not already defined
  if (!customElements.get('auth-button')) {
    customElements.define('auth-button', class extends CustomButtonElement { });
  }

  return `<auth-button button-text="${authButtonText}" onclick-listener="googleOauthSignIn"${customStyle}></auth-button>`;
}

export {
  googleLogin,
  getAuthButtonHtml
};