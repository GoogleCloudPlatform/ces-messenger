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

export { WIDGET_ATTRIBUTES, WIDGET_DEFAULTS, CES_WEBCHANNEL_ENDPOINTS, CES_HTTP_ENDPOINTS, cesUrlPattern, version};
