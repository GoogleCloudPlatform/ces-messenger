/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

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

const DEFAULTS = {
  MESSENGER_TYPE: 'bidi',
  MESSENGER_STYLE: 'large',
  DFCX_URL:
    'https://dialogflow.cloud.google.com/cx/projects/ccai-academy-bot/locations/global/agents/7329a01d-3a1e-4738-a32f-df7e2197023f/flows/00000000-0000-0000-0000-000000000000/flow_creation',
  PROJECT_ID: 'aiestaran-ccai',
  LOCATION: 'global',
  AGENT_ID: '7329a01d-3a1e-4738-a32f-df7e2197023f',
  CHAT_TITLE: 'My Demo Agent',
  INITIAL_MESSAGE: 'hi!',
  THEME_ID: 'current',
  INCLUDE_LINK_TO_SOURCE: false,
  DF_VERSION: 'prod',
  BACKGROUND_REPEAT: true,
  BIDI_THEME_ID: 'light',
  BIDI_STYLE_ID: 'chat',
  STREAMING_MODE: 'STREAMING_MODE_PROACTIVE',
  STREAMING_TTS: true,
  AUDIO_INPUT_MODE: 'DEFAULT_ON',
  BARGE_IN_SENSITIVITY: 'MEDIUM',
  BIDI_SIZE: 'large',
  DEPLOYMENT_ID: undefined,
};

const WIDGET_ATTRIBUTES = {
  apiUri: {
    type: String,
    default: undefined
  },
  // DEFAULT_ON, DEFAULT_OFF, SPACE_BAR_TO_TALK, NONE
  audioInputMode: {
    type: String,
    default: 'DEFAULT_ON'
  },
  // ALWAYS_ON, DEFAULT_ON, DEFAULT_OFF, DISABLED
  audioOutputMode: {
    type: String,
    default: 'DEFAULT_ON'
  },
  autoOpenChat: {
    type: [Boolean, String],
    default: false
  },
  // deprecated
  bidiSize: {
    type: String,
    default: 'large'
  },
  size: {
    type: String,
    default: 'large'
  },
  // deprecated
  bidiStyleId: {
    type: String,
    default: 'chat'
  },
  modality: {
    type: String,
    default: 'chat'
  },
  // deprecated
  bidiThemeId: {
    type: String,
    default: 'light'
  },
  themeId: {
    type: String,
    default: 'light'
  },
  cesUrl: {
    type: String,
    default: undefined
  },
  chatTitle: {
    type: String,
    default: ''
  },
  customConfigJson: {
    type: String,
    default: undefined
  },
  deploymentId: {
    type: String,
    default: undefined
  },
  disableImageUploads: {
    type: [Boolean, String],
    default: false
  },
  enableDebugger: {
    type: [Boolean, String],
    default: false
  },
  enableLiveTranscription: {
    type: [Boolean, String],
    default: false
  },
  environment: {
    type: String,
    required: false,
    default: undefined
  },
  imageUploadMaxWidth: {
    type: [Number, String],
    default: 800
  },
  imageUploadMaxHeight: {
    type: [Number, String],
    default: 800
  },
  imageUploadMaxNumber: {
    type: [Number, String],
    default: 4
  },
  initialMessage: {
    type: String,
    default: undefined
  },
  inputPlaceholderText: {
    type: String,
    default: 'What do you need help with?'
  },
  // https://cloud.google.com/text-to-speech/docs/list-voices-and-types
  languageCode: {
    type: String,
    default: 'en-US'
  },
  oauthClientId: {
    type: String,
    default: undefined
  },
  showErrorMessages: {
    type: [Boolean, String],
    default: false
  },
  // STREAMING_MODE_BASIC, STREAMING_MODE_PROACTIVE, STREAMING_MODE_PASSTHROUGH
  streamingMode: {
    type: String,
    default: 'STREAMING_MODE_PROACTIVE'
  },
  streamingTts: {
    type: [Boolean, String],
    default: true
  },
  tokenBrokerUrl: {
    type: String,
    default: undefined
  },
  // https://cloud.google.com/text-to-speech/docs/list-voices-and-types
  voice: {
    type: String,
    default: 'en-US-Chirp3-HD-Aoede'
  },
  websocketProxy: {
    type: String,
    default: undefined
  }
};

export { DEFAULTS, WIDGET_ATTRIBUTES, CES_WEBCHANNEL_ENDPOINTS, CES_HTTP_ENDPOINTS, cesUrlPattern, version};
