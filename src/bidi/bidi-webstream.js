/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  createWebChannelTransport,
  WebChannel,
} from '@firebase/webchannel-wrapper/webchannel-blob';
import { Logger } from '@/logger.js';
import { CES_WEBCHANNEL_ENDPOINTS, CES_HTTP_ENDPOINTS } from '@/agent-config.js';

class WebchannelBidiStream {
  constructor(env, agentId, listenerProvider) {
    if (!agentId) {
      throw new Error('Agent ID is required for WebchannelBidiStream.');
    }
    if (typeof listenerProvider !== 'function') {
      throw new Error('listenerProvider function is required for WebchannelBidiStream.');
    }

    this.agentId = agentId;
    this.connectionless = false;
    this.listenerProvider = listenerProvider;
    this.channel = null;
    this.transportFactory = createWebChannelTransport();
    this.accessToken = null;
    this.listeners = null; // Initialized when first needed

    // Derive project and region from agentId
    // Expected format: projects/<PROJECT_ID>/locations/<REGION_ID>/agents/<AGENT_ID>
    const agentIdParts = this.agentId.match(/projects\/([^/]+)\/locations\/([^/]+)\/(agents|apps)\/([^/]+)/);

    if (!agentIdParts || agentIdParts.length < 5) {
      throw new Error(`Invalid Agent ID format: ${this.agentId}. Expected: projects/<PROJECT_ID>/locations/<REGION_ID>/(agents|apps)/<AGENT_ID>`);
    }
    this.projectId = agentIdParts[1];
    this.gcpRegion = agentIdParts[2];
    if (agentIdParts[3] === 'agents') {
      this.serverWebChannelUrl = `https://${this.gcpRegion}-dialogflow.googleapis.com/ws/google.cloud.dialogflow.v3alpha1.Sessions/BidiStreamingDetectIntent`;
    } else {
      this.serverWebChannelUrl = `https://${CES_WEBCHANNEL_ENDPOINTS[env]}/ws/google.cloud.ces.v1.SessionService/BidiRunSession/locations/${this.gcpRegion}`;
    }
  }

  _ensureListeners() {
    if (!this.listeners) {
      this.listeners = this.listenerProvider();
      if (typeof this.listeners !== 'object' || this.listeners === null) {
        Logger.warn('WebchannelBidiStream: listenerProvider did not return a valid listeners object. Using empty object.');
        this.listeners = {};
      }
    }
  }

  _setupEventListeners() {
    if (!this.channel) return;
    this._ensureListeners();

    const ChannelEventType = WebChannel.EventType;

    this.channel.listen(ChannelEventType.OPEN, () => {
      Logger.log('WebchannelBidiStream: WebChannel OPENED!');
      if (this.listeners.onOpen) this.listeners.onOpen();
    });

    this.channel.listen(ChannelEventType.CLOSE, () => {
      Logger.log('WebchannelBidiStream: WebChannel CLOSED.');
      if (this.listeners.onClose) this.listeners.onClose();
      this.channel = null; // Clean up the channel reference
    });

    this.channel.listen(ChannelEventType.ERROR, (errorEvent) => {
      Logger.error('WebchannelBidiStream: WebChannel ERROR:', errorEvent);
      if (this.listeners.onError) this.listeners.onError(errorEvent);
    });

    this.channel.listen(ChannelEventType.MESSAGE, (messageEvent) => {
      //Logger.log('WebchannelBidiStream: WebChannel MESSAGE received:', messageEvent.data);
      if (this.listeners.onMessage) this.listeners.onMessage(messageEvent.data[0]);
    });
  }

  connect(accessToken) {
    if (!accessToken) {
      Logger.error('WebchannelBidiStream: Access Token is required to connect.');
      this._ensureListeners();
      if (this.listeners.onError) this.listeners.onError({ status: 'AUTH_ERROR', message: 'Access Token is required.' });
      return;
    }
    this.accessToken = accessToken;

    if (this.isConnected()) {
      Logger.warn('WebchannelBidiStream: Channel is already open.');
      this._ensureListeners();
      if (this.listeners.onOpen) this.listeners.onOpen(); // Notify listener if already open
      return;
    }

    // If channel exists but is not open (e.g., closed, errored), clean it up.
    if (this.channel) {
      try {
        this.channel.close();
      } catch (e) {
        Logger.warn('WebchannelBidiStream: Error closing existing channel before reconnect:', e);
      }
      this.channel = null;
    }

    this._ensureListeners(); // Ensure listeners are available for onConnecting

    Logger.log(`WebchannelBidiStream: Creating WebChannel to ${this.serverWebChannelUrl}...`);
    const channelOptions = {
      initMessageHeaders: {
        'Authorization': `Bearer ${this.accessToken}`,
        'X-Goog-User-Project': this.projectId,
      },
      messageContentType: 'application/json',
      sendRawJson: true,
      supportsCrossDomainXhr: true,
      httpSessionIdParam: 'gsessionid',
    };

    try {
      this.channel = this.transportFactory.createWebChannel(this.serverWebChannelUrl, channelOptions);
      this._setupEventListeners();

      Logger.log('WebchannelBidiStream: Attempting to open WebChannel...');
      if (this.listeners.onConnecting) this.listeners.onConnecting();
      this.channel.open();
    } catch (error) {
      Logger.error('WebchannelBidiStream: Error creating or opening WebChannel:', error);
      if (this.listeners.onError) this.listeners.onError({ status: 'CREATE_ERROR', message: 'Failed to create or open WebChannel', originalError: error });
      this.channel = null;
    }
  }

  disconnect() {
    if (this.channel) {
      Logger.log('WebchannelBidiStream: Attempting to close WebChannel...');
      this.channel.close(); // onClose listener will handle cleanup and UI
    } else {
      Logger.warn('WebchannelBidiStream: No active channel to disconnect.');
    }
  }

  sendMessage(payload) {
    this._ensureListeners();
    if (this.isConnected()) {
      //Logger.log('WebchannelBidiStream: Sending message:', payload);
      try {
        this.channel.send(payload);
        if (this.listeners.onMessageSent) this.listeners.onMessageSent(payload);
      } catch (e) {
        Logger.error('WebchannelBidiStream: Failed to send message:', e);
        if (this.listeners.onError) this.listeners.onError({ status: 'SEND_ERROR', message: 'Failed to send message', originalError: e });
      }
    } else {
      Logger.warn('WebchannelBidiStream: Cannot send message, channel is not open.');
      if (this.listeners.onError) this.listeners.onError({ status: 'NOT_CONNECTED', message: 'Cannot send: Not connected' });
    }
  }

  isConnected() {
    return !!(this.channel && this.channel.g && this.channel.g.G === 3);
  }
}

class WebsocketBidiStream {
  constructor(websocketUri, agentId, listenerProvider) {
    if (!agentId) {
      throw new Error('Agent ID is required for WebsocketBidiStream.');
    }
    if (typeof listenerProvider !== 'function') {
      throw new Error('listenerProvider function is required for WebsocketBidiStream.');
    }

    this.agentId = agentId;
    this.connectionless = false;
    this.listenerProvider = listenerProvider;
    this.websocket = null;
    this.listeners = null; // Initialized when first needed

    // Derive project and region from agentId
    // Expected format: projects/<PROJECT_ID>/locations/<REGION_ID>/agents/<AGENT_ID>
    const agentIdParts = this.agentId.match(/projects\/([^/]+)\/locations\/([^/]+)\/(agents|apps)\/([^/]+)/);
    if (!agentIdParts || agentIdParts.length < 5) {
      throw new Error(`Invalid Agent ID format: ${this.agentId}. Expected: projects/<PROJECT_ID>/locations/<REGION_ID>/(agents|apps)/<AGENT_ID>`);
    }
    this.projectId = agentIdParts[1];
    this.gcpRegion = agentIdParts[2];

    this.serverWebsocketUri = websocketUri;
  }

  _ensureListeners() {
    if (!this.listeners) {
      this.listeners = this.listenerProvider();
      if (typeof this.listeners !== 'object' || this.listeners === null) {
        Logger.warn('WebsocketBidiStream: listenerProvider did not return a valid listeners object. Using empty object.');
        this.listeners = {};
      }
    }
  }

  _setupEventListeners() {
    if (!this.websocket) return;
    this._ensureListeners();

    this.websocket.onopen = this.listeners.onOpen;
    this.websocket.onclose = (event) => {
      Logger.log('WebsocketBidiStream: Websocket CLOSED.');
      this.websocket = null;
      if (this.listeners.onClose) this.listeners.onClose(event);
    };
    this.websocket.onerror = this.listeners.onError;
    this.websocket.onmessage = async (event) => {
      const event_data = event.data;
      let text;
      if (event_data instanceof Blob) {
        text = await new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result);
          reader.onerror = reject;
          reader.readAsText(event_data);
        });
      } else {
        text = event_data;
      }
      const message = JSON.parse(text);
      if (message.connection_closed) {
        Logger.log('Received connection_closed message: ', message);
      }
      this.listeners.onMessage(message);
    };
  }

  connect() {
    Logger.log('WebsocketBidiStream: Attempting to open websocket...');
    if (this.isConnected()) {
      Logger.warn('WebsocketBidiStream: websocket is already open.');
      this._ensureListeners();
      if (this.listeners.onOpen) this.listeners.onOpen(); // Notify listener if already open
      return;
    }

    // If websocket exists but is not open (e.g., closed, errored), clean it up.
    if (this.websocket !== null) {
      Logger.log('WebsocketBidiStream: Closing existing websocket...');
      try {
        this.websocket.close();
      } catch (e) {
        Logger.warn('WebsocketBidiStream: Error closing existing websocket before reconnect:', e);
      }
      this.websocket = null;
    }

    this._ensureListeners(); // Ensure listeners are available for onConnecting

    try {
      Logger.log(`WebsocketBidiStream: Creating websocket to ${this.serverWebsocketUri}...`);
      this.websocket = new WebSocket(this.serverWebsocketUri);
      this._setupEventListeners();
      if (this.listeners.onConnecting) this.listeners.onConnecting();
    } catch (error) {
      Logger.error('WebsocketBidiStream: Error creating or opening websocket:', error);
      if (this.listeners.onError) this.listeners.onError({ status: 'CREATE_ERROR', message: 'Failed to create or open websocket', originalError: error });
      this.websocket = null;
    }
  }

  disconnect() {
    if (this.websocket) {
      Logger.log('WebsocketBidiStream: Attempting to close websocket...');
      this.websocket.close();
      this.websocket = null;
    } else {
      Logger.warn('WebsocketBidiStream: No active websocket to disconnect.');
    }
  }

  sendMessage(payload) {
    this._ensureListeners();
    if (this.isConnected()) {
      try {
        var payload_str = payload;
        if (typeof payload !== 'string') {
          payload_str = JSON.stringify(payload);
        }

        this.websocket.send(payload_str);
        if (this.listeners.onMessageSent) this.listeners.onMessageSent(payload);
      } catch (e) {
        Logger.error('WebsocketBidiStream: Failed to send message:', e);
        if (this.listeners.onError) this.listeners.onError({ status: 'SEND_ERROR', message: 'Failed to send message', originalError: e });
      }
    } else {
      Logger.warn('WebsocketBidiStream: Cannot send message, websocket is not open.');
      if (this.listeners.onError) this.listeners.onError({ status: 'NOT_CONNECTED', message: 'Cannot send: Not connected' });
    }
  }

  isConnected() {
    return !!(this.websocket && this.websocket.readyState === WebSocket.OPEN);
  }
}

class HttpRequestResponseStream {
  constructor(env, agentId, listenerProvider, sessionId, apiUri) {
    if (!agentId) {
      throw new Error('Agent ID is required for HttpRequestResponseStream.');
    }
    if (typeof listenerProvider !== 'function') {
      throw new Error('listenerProvider function is required for HttpRequestResponseStream.');
    }

    this.agentId = agentId;
    this.connectionless = true;
    this.listenerProvider = listenerProvider;
    this.accessToken = null;
    this.listeners = null; // Initialized when first needed
    this.sessionId = sessionId;

    // Derive project and region from agentId
    // Expected format: projects/<PROJECT_ID>/locations/<REGION_ID>/agents/<AGENT_ID>
    const agentIdParts = this.agentId.match(/projects\/([^/]+)\/locations\/([^/]+)\/(agents|apps)\/([^/]+)/);

    if (!agentIdParts || agentIdParts.length < 5) {
      throw new Error(`Invalid Agent ID format: ${this.agentId}. Expected: projects/<PROJECT_ID>/locations/<REGION_ID>/(agents|apps)/<AGENT_ID>`);
    }
    this.projectId = agentIdParts[1];
    this.gcpRegion = agentIdParts[2];
    if (agentIdParts[3] === 'agents') {
      // TODO: add support for DialogFlow agents (if needed).
      throw new Error(`Invalid Agent ID type: ${this.agentId}. Text-only mode not supported for DialogFlow agents. Use df-messenger instead (https://cloud.google.com/dialogflow/cx/docs/concept/integration/dialogflow-messenger).`);
      // this.sessionUrl = `https://${this.gcpRegion}-dialogflow.googleapis.com/ws/google.cloud.dialogflow.v3alpha1.Sessions/BidiStreamingDetectIntent`;
    } else {
      if (apiUri?.match(/^https:\/\//)) {
        this.sessionUrl = `${apiUri}/${this.agentId}/sessions/${this.sessionId}:runSession`;
      } else {
        this.sessionUrl = `https://${CES_HTTP_ENDPOINTS[env]}/v1beta/${this.agentId}/sessions/${this.sessionId}:runSession`;
      }
    }
  }

  _ensureListeners() {
    if (!this.listeners) {
      this.listeners = this.listenerProvider();
      if (typeof this.listeners !== 'object' || this.listeners === null) {
        Logger.warn('HttpRequestResponseStream: listenerProvider did not return a valid listeners object. Using empty object.');
        this.listeners = {};
      }
    }
  }

  connect(accessToken) {
    this._ensureListeners();
    this.accessToken = accessToken;
    if (this.listeners.onOpen) this.listeners.onOpen();
  }

  disconnect() {
    this.accessToken = null;
  }

  sendMessage(payload) {
    this._ensureListeners();
    if (typeof payload !== 'string') {
      payload = JSON.stringify(payload);
    }
    if (this.isConnected()) {
      const headers = {
        'Content-Type': 'application/json',
      };
      if (this.accessToken) {
        headers['Authorization'] = `Bearer ${this.accessToken}`;
      }
      fetch(this.sessionUrl, {
        method: 'POST',
        headers: headers,
        body: payload
      })
        .then(response => {
          if (!response.ok) {
            return response.text().then(errorText => {
              throw new Error(`HTTP error! status: ${response.status}, message: ${errorText}`);
            });
          }
          return response.json();
        })
        .then(data => {
          if (this.listeners.onMessage) this.listeners.onMessage(data);
          if (this.listeners.onMessageSent) this.listeners.onMessageSent(payload);
        })
        .catch(e => {
          Logger.error('HttpRequestResponseStream: Failed to send message:', e);
          if (this.listeners.onError) {
            if (e.status === 401) {
              this.listeners.onError({ status: 'AUTH_ERROR', message: e.message ? e.message : 'Authentication error.' });

            } else if (e.status === 403) {
              this.listeners.onError({ status: 'AUTH_ERROR', message: e.message ? e.message : 'Authorization error.' });

            } else {
              this.listeners.onError({ status: 'SEND_ERROR', message: e.message ? e.message : 'Failed to send message.' });
            }
          }

        });
    } else {
      Logger.warn('HttpRequestResponseStream: Cannot send message, access token is required.');
      if (this.listeners.onError) this.listeners.onError({ status: 'NOT_CONNECTED', message: 'Cannot send: Not connected' });
    }
  }

  isConnected() {
    return this.accessToken !== null;
  }
}

export { WebsocketBidiStream, WebchannelBidiStream, HttpRequestResponseStream };