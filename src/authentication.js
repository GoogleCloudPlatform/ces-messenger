/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { ref } from 'vue';
import { Logger } from '@/logger.js';
import { agentConfigInstance } from '@/agent-config.js';
import { CES_HTTP_ENDPOINTS } from '@/agent-config.js';

const accessToken = ref(null);
const accessTokenExpiresAt = ref(null);
const redirecting = ref(false);
const AUTH_TOKEN_LEEWAY = 300000; // 5 minutes

function setAccessToken(token, expirationSeconds=3600) {
  accessToken.value = token;
  localStorage.accessToken = token;
  accessTokenExpiresAt.value = localStorage.accessTokenExpiresAt = Date.now() + expirationSeconds*1000;
}

function isTokenValid() {
  return accessToken.value != null && accessTokenExpiresAt.value != null && accessTokenExpiresAt.value > (Date.now() + AUTH_TOKEN_LEEWAY);
}

async function authenticate(env, agentId, sessionId) {
  const agentConfig = agentConfigInstance.config;
  // handle tokens from local storage
  if (localStorage.accessToken) {
    accessToken.value = localStorage.accessToken;
    accessTokenExpiresAt.value = localStorage.accessTokenExpiresAt ? localStorage.accessTokenExpiresAt : null;
  }

  // Current token seems valid
  if (isTokenValid()) {
    return true;
  }

  // If we have a token broker configured, go get the token from there
  if (agentConfig.tokenBrokerUrl) {
    return await refreshToken(env, agentId, sessionId);
    // Clean up local storage and give up. Authentication will need to be done via OAuth
  } else {
    signOut();
    return false;
  }
}

async function refreshToken(env, agentId, sessionId) {
  const agentConfig = agentConfigInstance.config;
  if (!agentConfig.tokenBrokerUrl) return false;

  try {
    let response;
    let tokenKey = 'access_token';
    let expiryKey = 'expiry';

    if (agentConfig.tokenBrokerUrl.toUpperCase() == 'MANAGED') {
      tokenKey = 'chatToken';
      expiryKey = 'expireTime';

      const requestBody = {
        deployment: agentConfig.deploymentId
      };

      const tokenBrokerUrl = `https://${CES_HTTP_ENDPOINTS[env]}/v1/${agentId}/sessions/${sessionId}:generateChatToken`;
      response = await fetch(tokenBrokerUrl, { 
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody)
      });
    } else {
      response = await fetch(agentConfig.tokenBrokerUrl, { credentials: 'include' });
    }

    const data = await response.json();
    if (data[tokenKey] && data[expiryKey]) {
      accessToken.value = data[tokenKey];
      accessTokenExpiresAt.value = typeof data[expiryKey] === 'number' && !isNaN(data[expiryKey]) ? data[expiryKey] : (new Date(data[expiryKey])).getTime();

      // Tokens received from the managed token broker cannot be reused across sessions.
      if (agentConfig.tokenBrokerUrl.toUpperCase() != 'MANAGED') {
        localStorage.accessToken = accessToken.value;
        localStorage.accessTokenExpiresAt = accessTokenExpiresAt.value;
      }
      Logger.debug('Token received from token broker:', data);
      return true;
    } else {
      Logger.error('No token received from token broker:', data);
      return false;
    }
  } catch (error) {
    Logger.error('Error fetching impersonated token:', error.message);
    // Attempt to differentiate between CORS and other network errors.
    if (error instanceof TypeError && error.message === 'Failed to fetch') {
      try {
        // Send a no-cors request to check for reachability.
        // This will succeed if the server is up, even if it's a CORS error.
        await fetch(agentConfig.tokenBrokerUrl, { mode: 'no-cors' });
        // If the above line does not throw, the server is reachable. The error is likely CORS.
        // Although it could also be a 404, or other HTTP error.
        window.kite.insertErrorMessage(`The token broker at <code>${agentConfig.tokenBrokerUrl}</code> may have a CORS configuration issue. 
          <ol style="margin-left: 20px; font-size: smaller; padding: 0">
            <li>Ensure the token broker URL is correct, and responds with a 200 status code.</li>
            <li>Ensure the current origin (<code>${window.location.origin}</code>) is included in your token broker's <code>AUTHORIZED_ORIGINS</code> environment variable.</li>
          </ol>`, true);
      } catch (reachabilityError) {
        // The no-cors request also failed, so the server is likely unreachable.
        window.kite.insertErrorMessage(`The token broker at <code>${agentConfig.tokenBrokerUrl}</code> is unreachable. Please verify the URL and ensure the service is running.`, true);
      }
    } else {
      // For other types of errors, show a generic message.
      window.kite.insertErrorMessage(`An error occurred while trying to contact the token broker at <code>${agentConfig.tokenBrokerUrl}</code>.`, true);
    }
    return false;
  }
}

// eslint-disable-next-line no-unused-vars
function googleOauthSignIn(messageId) {
  const agentConfig = agentConfigInstance.config;
  redirecting.value = true;
  googleLogin(continueLogin, agentConfig.oauthClientId);
}

function signOut() {
  // TODO: invalidate OAuth token
  // TODO: complete with other auth types when available
  localStorage.removeItem('accessToken');
  localStorage.removeItem('accessTokenExpiresAt');
  accessToken.value = null;
  accessTokenExpiresAt.value = null;
}

async function googleLogin(callback, clientId) {
  // eslint-disable-next-line no-undef
  google.accounts.oauth2.initTokenClient({
    client_id: clientId,
    //scope: 'https://www.googleapis.com/auth/ces https://www.googleapis.com/auth/dialogflow',
    scope: 'https://www.googleapis.com/auth/cloud-platform',
    callback: callback
  }).requestAccessToken();
}

async function continueLogin(response) {
  accessToken.value = response.access_token;
  const expirationSeconds = response.expires_in;
  const now = new Date();
  accessTokenExpiresAt.value = now.getTime() + (expirationSeconds * 1000);
  localStorage.accessToken = accessToken.value;
  localStorage.accessTokenExpiresAt = accessTokenExpiresAt.value;
  agentConfigInstance.messages.value = agentConfigInstance.messages.value.filter(message => message.msg_type !== 'AUTH_BUTTON');
  startConversation();
}


export { setAccessToken, signOut, authenticate, isTokenValid, refreshToken, googleOauthSignIn, accessToken, accessTokenExpiresAt, redirecting};