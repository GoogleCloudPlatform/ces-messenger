/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { ref } from 'vue';

const version = import.meta.env.VITE_VERSION || 'live';
const devEndpointWebchannel = import.meta.env.VITE_DEV_ENDPOINT_WEBCHANNEL;
const devEndpointHttp = import.meta.env.VITE_DEV_ENDPOINT_HTTP;

const cesUrlPattern =
  /projects\/(?<project_id>[^/]+)\/locations\/(?<location>[^/]+)\/(?<agent_type>agents|apps)\/(?<agent_id>[^/]+)/;

const CES_WEBCHANNEL_ENDPOINTS = {
  'prod': 'ces-webchannel.googleapis.com'
};

const CES_HTTP_ENDPOINTS = {
  'prod': 'ces.googleapis.com'
};

if (devEndpointWebchannel) {
  CES_WEBCHANNEL_ENDPOINTS.dev = devEndpointWebchannel;
}

if (devEndpointHttp) {
  CES_HTTP_ENDPOINTS.dev = devEndpointHttp;
}

export const RECONNECT_DELAY = 500;
export const RECONNECT_DELAY_MULTIPLIER = 2;
export const RECONNECT_MAX_ATTEMPS = 5;

const WIDGET_ATTRIBUTES = {
  apiUri: {
    type: String
  },
  // DEFAULT_ON, DEFAULT_OFF, SPACE_BAR_TO_TALK, NONE
  audioInputMode: {
    type: String
  },
  // ALWAYS_ON, DEFAULT_ON, DEFAULT_OFF, DISABLED
  audioOutputMode: {
    type: String
  },
  autoOpenChat: {
    type: [Boolean, String]
  },
  disableBubble: {
    type: [Boolean, String]
  },
  // deprecated
  bidiSize: {
    type: String
  },
  size: {
    type: String
  },
  // deprecated
  bidiStyleId: {
    type: String
  },
  modality: {
    type: String
  },
  // deprecated
  bidiThemeId: {
    type: String
  },
  themeId: {
    type: String
  },
  cesUrl: {
    type: String
  },
  chatTitle: {
    type: String
  },
  customConfigJson: {
    type: String
  },
  deploymentId: {
    type: String
  },
  disableImageUploads: {
    type: [Boolean, String]
  },
  enableDebugger: {
    type: [Boolean, String]
  },
  enableLiveTranscription: {
    type: [Boolean, String]
  },
  environment: {
    type: String,
    required: false
  },
  hideInitialMessage: {
    type: [Boolean, String]
  },
  imageUploadMaxWidth: {
    type: [Number, String]
  },
  imageUploadMaxHeight: {
    type: [Number, String]
  },
  imageUploadMaxNumber: {
    type: [Number, String]
  },
  initialMessage: {
    type: String
  },
  inputPlaceholderText: {
    type: String
  },
  // https://cloud.google.com/text-to-speech/docs/list-voices-and-types
  languageCode: {
    type: String
  },
  oauthClientId: {
    type: String
  },
  showErrorMessages: {
    type: [Boolean, String]
  },
  // STREAMING_MODE_BASIC, STREAMING_MODE_PROACTIVE, STREAMING_MODE_PASSTHROUGH
  streamingMode: {
    type: String
  },
  streamingTts: {
    type: [Boolean, String]
  },
  tokenBrokerUrl: {
    type: String
  },
  // https://cloud.google.com/text-to-speech/docs/list-voices-and-types
  voice: {
    type: String
  },
  websocketProxy: {
    type: String
  }
};

const WIDGET_DEFAULTS = {
  // DEFAULT_ON, DEFAULT_OFF, SPACE_BAR_TO_TALK, NONE
  audioInputMode: 'DEFAULT_OFF',
  // ALWAYS_ON, DEFAULT_ON, DEFAULT_OFF, DISABLED
  audioOutputMode: 'DEFAULT_ON',
  autoOpenChat: false,
  disableBubble: false,
  chatTitle: '',
  disableImageUploads: false,
  enableDebugger: false,
  enableLiveTranscription: false,
  hideInitialMessage: true,
  imageUploadMaxWidth: 800,
  imageUploadMaxHeight: 800,
  imageUploadMaxNumber: 4,
  inputPlaceholderText: 'What do you need help with?',
  // https://cloud.google.com/text-to-speech/docs/list-voices-and-types
  languageCode: 'en-US',
  modality: 'chat',
  showErrorMessages: false,
  // STREAMING_MODE_BASIC, STREAMING_MODE_PROACTIVE, STREAMING_MODE_PASSTHROUGH
  streamingMode: 'STREAMING_MODE_PROACTIVE',
  streamingTts: true,
  themeId: 'light',
  size: 'large',
  // https://cloud.google.com/text-to-speech/docs/list-voices-and-types
  voice: 'en-US-Chirp3-HD-Aoede',
}

class AgentConfig {
  constructor() {
    if (AgentConfig.instance) {
      return AgentConfig.instance;
    }
    this.config = {};
    this.messages = ref([]);
    AgentConfig.instance = this;
  }

  initialize(props) {
    const agentConfig = {};

    for (let [key, value] of Object.entries(props)) {
      // Convert booleans and numbers
      if (value && value !== '') {
        if (Array.isArray(WIDGET_ATTRIBUTES[key]['type'])) {
          if (WIDGET_ATTRIBUTES[key]['type'].includes(Boolean) && typeof value !== 'boolean') {
            if (['yes', 'true', '1'].includes(value.toLowerCase())) value = true;
            else if (['no', 'false', '0'].includes(value.toLowerCase())) value = false;
          }
          if (WIDGET_ATTRIBUTES[key]['type'].includes(Number) && typeof value !== 'number') {
            if (!isNaN(parseInt(value))) {
              value = parseInt(value);
            } else {
              continue;
            }
          }
        }
        agentConfig[key] = value;
      }

      // translate legacy modes
      if (key === 'audioInputMode') {
        if (agentConfig[key] === 'OPEN_MIC') {
          agentConfig[key] = 'DEFAULT_ON';
        } else if (agentConfig[key] === 'PUSH_TO_TALK_BUTTON') {
          agentConfig[key] = 'DEFAULT_OFF';
        } else if (agentConfig[key] === 'PUSH_TO_TALK_DISCREET') {
          agentConfig[key] = 'SPACE_BAR_TO_TALK';
        }
      }
    }

    // Apply defaults from WIDGET_DEFAULTS to agentConfig
    for (let [key, value] of Object.entries(WIDGET_DEFAULTS)) {
      if (agentConfig[key] === undefined) {
        agentConfig[key] = value;
      }
    }

    // Map deprecated parameters to new ones if not already defined
    const deprecatedParamMappings = {
      bidiSize: 'size',
      bidiStyleId: 'modality',
      bidiThemeId: 'themeId'
    };

    for (let [key, value] of Object.entries(deprecatedParamMappings)) {
      if (agentConfig[key] !== undefined) {
        if (agentConfig[value] === undefined || agentConfig[value] === WIDGET_DEFAULTS[value]) {
          agentConfig[value] = agentConfig[key];
        }
        delete agentConfig[key];
      }
    }

    // support legacy websocketProxy parameter
    if (agentConfig.websocketProxy && !agentConfig.apiUri) {
      agentConfig.apiUri = agentConfig.websocketProxy;
    }

    if (typeof agentConfig.audioInputMode === 'string') {
      agentConfig.audioInputMode = agentConfig.audioInputMode.toUpperCase();
    }

    if (agentConfig.apiUri &&
      (agentConfig.apiUri.startsWith('wss://') || agentConfig.apiUri.startsWith('ws://'))) {
      agentConfig.websocketUri = agentConfig.apiUri;
    }

    if (agentConfig.cesUrl?.includes('console-dev') || agentConfig.deploymentId?.includes('console-dev')) {
      agentConfig.environment = 'dev';
    }

    if (agentConfig.deploymentId) {
      if (agentConfig.deploymentId.match(/projects\/[^/]+\/locations\/[^/]+\/apps\/[^/]+\/deployments\/[^/]+$/)) {
        agentConfig.deploymentId = agentConfig.deploymentId.match(/projects\/[^/]+\/locations\/[^/]+\/apps\/[^/]+\/deployments\/[^/]+$/)[0];
        agentConfig.cesUrl = agentConfig.deploymentId;
      } else if (!agentConfig.deploymentId.includes('/') && agentConfig.cesUrl?.match(/projects\/[^/]+\/locations\/[^/]+\/apps\/[^/]+$/)) {
        agentConfig.cesUrl = agentConfig.deploymentId = `${agentConfig.cesUrl.match(/projects\/[^/]+\/locations\/[^/]+\/apps\/[^/]+$/)[0]}/deployments/${agentConfig.deploymentId}`;
      } else {
        throw new Error(`Invalid deployment ID: ${agentConfig.deploymentId}. Expected format: projects/<PROJECT_ID>/locations/<REGION_ID>/apps/<AGENT_ID>/deployments/<DEPLOYMENT_ID>.`);
      }
    }

    this.config = agentConfig;
  }
}

const agentConfigInstance = new AgentConfig();

export { WIDGET_ATTRIBUTES, WIDGET_DEFAULTS, CES_WEBCHANNEL_ENDPOINTS, CES_HTTP_ENDPOINTS, cesUrlPattern, version, agentConfigInstance };
