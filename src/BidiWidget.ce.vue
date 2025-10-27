<!--
 @license
 Copyright 2025 Google LLC
 SPDX-License-Identifier: Apache-2.0
-->
<template>
  <section
    class="voice-assistant-container authorized"
    :class="bidiClasses"
  >
    <div
      v-if="chatUiStatus === 'collapsed' && !agentConfig.disableBubble"
      class="assistant-collapsed"
      @click="open"
    >
      <img :src="`data:image/svg+xml;utf8,${encodeURIComponent(iconChat)}`">
    </div>
    <div
      v-if="chatUiStatus === 'expanded'"
      class="assistant-container"
    >
      <main :class="bidiClasses">
        <header>
          <h1>{{ agentConfig.chatTitle }}</h1>
          <div v-if="displayMuteButton">
            <div
              v-if="!isCallMode && isAudioPlaying && audioEnabled"
              class="call-circle icon moving"
              @click="toggleAudioOutput"
            >
              <div class="call-circle-inner">
                <div
                  v-for="index in WAVE_ITEM_COUNT['icon']"
                  :key="index"
                  class="wave"
                />
              </div>
            </div>
            <div
              v-else
              class="mute-button"
              :class="{ muted: !audioEnabled }"
              @click="toggleAudioOutput"
            />
          </div>
          <div
            class="close-button"
            @click="close"
          >
            <img :src="`data:image/svg+xml;utf8,${encodeURIComponent(iconClose)}`">
          </div>
        </header>
        <ul ref="message-box">
          <li
            v-for="(message, index) in messages"
            :key="index"
            :data-message-index="index"
            :class="{
              'from-user': message.actor === 'USER',
              'from-bot': message.actor === 'BOT',
              'text-response': !!message.text,
              'last': message === messages[messages.length - 1],
              'last-rich-content': index === lastRichContentMessageIndex,
              'is-displayed-in-call': index === lastBotMessageIndex
            }">
            <span v-if="message.text && !message.html">{{ message.text }}</span>
            <span
              v-if="message.html"
              v-html="message.html"
            />
            <span
              v-if="message.payload?.html"
              v-html="message.payload.html"
              @click="handleMessageClick($event, message, index)"
            />
          </li>
          <li
            v-if="agentConfig.modality === 'call'"
            class="call-circle"
            :class="{ moving: isAudioPlaying }"
          >
            <div class="call-circle-inner">
              <div
                v-for="index in WAVE_ITEM_COUNT[agentConfig.bidiSize]"
                :key="index"
                class="wave"
              />
            </div>
          </li>
        </ul>
        <footer>
          <div
            v-if="connectedMode && allowInput"
            class="footer-container"
          >
            <div class="input-container">
              <div
                v-if="allowUploads && !isCallMode"
                class="upload-container"
                draggable="false"
                @click="uploadFile()"
              >
                <div class="plus-container">
                  add an image
                </div>
                <div
                  v-if="showUploadOverlay"
                  class="upload-overlay"
                >
                  <div
                    class="upload-option"
                    @click.stop="triggerFileUpload"
                  >
                    <img :src="`data:image/svg+xml;utf8,${encodeURIComponent(iconPicture)}`">Upload
                    image
                  </div>
                  <div
                    v-if="canTakePicture"
                    class="upload-option"
                    @click.stop="triggerCameraCapture"
                  >
                    <img :src="`data:image/svg+xml;utf8,${encodeURIComponent(iconPhoto)}`">Take
                    picture
                  </div>
                </div>
              </div>

              <div
                v-if="!isCallMode"
                class="input-wrapper"
              >
                <div
                  v-if="imgUploadQueue.length > 0"
                  class="upload-images"
                >
                  <div
                    v-for="(image, index) in imgUploadQueue"
                    :key="index"
                    class="image-preview-container"
                  >
                    <img :src="`${image}`">
                    <button
                      class="remove-image-button"
                      @click="removeImage(index)"
                    >
                      <img
                        :src="`data:image/svg+xml;utf8,${iconClose}`"
                        alt="Remove image"
                      >
                    </button>
                  </div>
                </div>
                <textarea
                  v-if="!isCallMode"
                  ref="user-input"
                  v-model="currentUserInput"
                  :placeholder="inputPlaceholderText"
                  rows="1"
                  @keydown="processInputField"
                />
              </div>
              <div
                v-if="allowInput && showMicButton"
                class="talk-button"
                :class="{ talking: !!talking, chat: agentConfig.modality === 'chat' }"
                draggable="false"
                @click="setTalkingMode(!talking)"
              >
                <div
                  v-if="!!talking"
                  class="call-circle icon"
                  :class="{ moving: voiceDetected }"
                >
                  <div class="call-circle-inner">
                    <div
                      v-for="index in WAVE_ITEM_COUNT['icon']"
                      :key="index"
                      class="wave"
                    />
                  </div>
                </div>
                <div
                  class="mic-container"
                  :class="{ talking: !!talking, chat: agentConfig.modality === 'chat' }"
                >
                  <img
                    :src="`data:image/svg+xml;utf8,${(talking || agentConfig.modality === 'chat') ? encodeURIComponent(iconTalking) : encodeURIComponent(iconTalkingOff)}`"
                  >
                </div>
              </div>
            </div>
            <div
              v-if="!isCallMode"
              class="footer-buttons"
            >
              <button
                :disabled="!currentUserInput && imgUploadQueue.length == 0"
                class="send"
                @click="submitUserInput"
              >
                send
              </button>
            </div>
          </div>
          <div
            v-else-if="isConfigValid && ((!isConnected) || needsUserInteractionToResume)"
            class="footer-container reconnect-container"
          >
            <button
              class="reconnect-button"
              @click="reconnect"
            >
              {{ reconnectButtonText }}
            </button>
          </div>
        </footer>
      </main>
    </div>
  </section>
  <pre v-if="false">
        Debug info:
          isConfigValid: {{ isConfigValid }}
          talking: {{ talking }}
          currentUserInput: {{ currentUserInput }}
          connectedMode: {{ connectedMode }}
          isConnected: {{ isConnected }}
          allowInput: {{ allowInput }}
          allowUploads: {{ allowUploads }}
          disconnectReason: {{ disconnectReason }}
          needsUserInteractionToResume: {{ needsUserInteractionToResume }}
          isAudioPlaying: {{ isAudioPlaying }}
          handoffInflight: {{ handoffInflight }}
          isSpacebarPressedForTalk: {{ isSpacebarPressedForTalk }}
          isResumedSession: {{ isResumedSession }}
          audioContextState: {{ audioContextState }}
          disconnectReasonDescription: {{ disconnectReasonDescription }}
    </pre>

  <section
    v-if="handoffInflight"
    class="inflight-handoff"
  />
</template>

<script setup>
import { computed, ref, onMounted, onUnmounted, watch, nextTick, useTemplateRef } from 'vue';
import { WebchannelBidiStream, WebsocketBidiStream, HttpRequestResponseStream } from '@/bidi/bidi-webstream.js';
import { authenticate, setAccessToken, signOut, isTokenValid, refreshToken, googleOauthSignIn, accessToken } from '@/authentication.js';
import { AudioStreamerFactory } from '@/audio/audio-streamer.js';
import { AudioRecorder } from '@/audio/audio-recorder.js';
import { AdaptorFactory, BidiStreamingDetectIntentAdaptor, BidiRunSessionAdaptor, RunSessionAdaptor } from '@/bidi/bidi-adaptors.js';
import { FunctionToolHandler } from '@/function-tools';
import { renderTemplate, registerTemplate } from '@/templates/index.js';
import { DomHintTracker } from '@/dom-hints.js';
import { googleSdkLoaded } from 'vue3-google-login';
import { Logger } from '@/logger.js';
import { agentConfigInstance, WIDGET_ATTRIBUTES, WIDGET_DEFAULTS, RECONNECT_DELAY, RECONNECT_DELAY_MULTIPLIER, RECONNECT_MAX_ATTEMPS } from '@/agent-config.js';
import { marked } from 'marked';

// Import all icons so we can inline them
import iconChat from './assets/img/icon-chat.svg?raw';
import iconClose from './assets/img/icon-close.svg?raw';
import iconTalking from './assets/img/icon-talking.svg?raw';
import iconTalkingOff from './assets/img/icon-talking-off.svg?raw';
import iconPicture from './assets/img/icon-picture.svg?raw';
import iconPhoto from './assets/img/icon-photo.svg?raw';

const BIDI_WIDGET_SESSION_KEY = 'bidi-widget-session';

// how many wave items to animate
const WAVE_ITEM_COUNT = {
  'large': 14,
  'small': 12,
  'icon': 3
};

// Set up logging
const logger = new Logger();

if (typeof window.kite === 'undefined') {
  window.kite = {};
}
const cesmHooks = {};

// Agent configuration
const props = defineProps(WIDGET_ATTRIBUTES);
agentConfigInstance.initialize(props);
const agentConfig = agentConfigInstance.config;
const messages = agentConfigInstance.messages;

let currentUserInput = ref('');
let chatUiStatus = ref(agentConfig.autoOpenChat ? 'expanded' : 'collapsed');

// Speech detection
let voiceDetected = ref(false);
let lastVoiceDetected = new Date(0);
const VAD_TIMEOUT = 200;
const VAD_THRESHOLD = 0.01;


let websocketUri = agentConfig.websocketUri;

// Set logging as specified in config
logger.enableDebugger = agentConfig.enableDebugger;

// Query variables
let queryVars = {};

function setQueryParameters(params) {
  Logger.log('Setting query parameters:', params);
  // check that the given parameters are a key/value object
  if (typeof params !== 'object' || params === null) {
    return;
  }
  // empty the current variables first
  for (let key in queryVars) {
    delete queryVars[key];
  }
  // add the new ones
  for (let [key, value] of Object.entries(params)) {
    queryVars[key] = value;
  }
}

const pushToTalk = !['DEFAULT_ON', 'NONE', undefined].includes(agentConfig.audioInputMode);

// Classes for bidi widget
const bidiClasses = ref([
  agentConfig.themeId || WIDGET_DEFAULTS.themeId,
  agentConfig.modality || WIDGET_DEFAULTS.modality,
  agentConfig.size || WIDGET_DEFAULTS.size,
  agentConfig.deploymentId || WIDGET_DEFAULTS.deploymentIdD
]);

// load Google auth sdk if needed
let authLoaded = ref(false);
if (agentConfig.oauthClientId) {
  googleSdkLoaded(() => {
    authLoaded.value = true;
  });
}

// Constants
const bidiAdaptor = AdaptorFactory.createAdaptor(agentConfig);

// Setting up Audio objects, if needed
let audioRecorder = null;
let audioContext = null;
let audioStreamer = null;
let audioContextState = ref(null);

if (agentConfig.audioInputMode !== 'NONE') {
  let sampleRate = 16e3;
  const configMessage = bidiAdaptor.getConfigMessage(agentConfig, null);
  if (bidiAdaptor.appId == 'BIDI_ADK') { // ADK
    // ADK uses 24kHz sample rate
    sampleRate = 24000;
    // They also bring their own websosket server
    websocketUri = agentConfig.cesUrl;
  } else if (configMessage.configMessage?.outputAudioConfig?.sample_rate_hertz) { // PBL
    sampleRate = configMessage.configMessage.outputAudioConfig.sample_rate_hertz;
  } else if (configMessage.config?.outputAudioConfig?.sampleRateHertz) { // PS
    sampleRate = configMessage.config.outputAudioConfig.sampleRateHertz;
  }

  audioRecorder = new AudioRecorder();
  audioContext = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: sampleRate });

  if (agentConfig.audioOutputMode === 'NONE') {
    audioStreamer = AudioStreamerFactory.createStreamer(audioContext, 'SILENT');
  } else {
    audioStreamer = AudioStreamerFactory.createStreamer(audioContext);
    audioStreamer.onComplete = () => {
      isAudioPlaying.value = false;
      // A session disconnect was requested
      if (disconnectReason.value) {
        Logger.log('Disconnecting with reason:', disconnectReason.value);
        pauseConversation();
        disconnectWebStream(disconnectReason.value);
      }
    };
  }

  // Playbooks Live specific settings
  if (bidiAdaptor instanceof BidiStreamingDetectIntentAdaptor) {
    // Add fade-in at the begining of the audio to avoid the click sound
    audioStreamer.fadeIn = true;
    // Adjust barge-in sensitivity
    if (!agentConfig.bargeInSensitivity) agentConfig.bargeInSensitivity = 'MEDIUM';

    if (agentConfig.bargeInSensitivity == 'LOW') {
      bidiAdaptor.bargeInTranscriptsTrigger = 5;
      bidiAdaptor.bargeInMaxGapMs = 300;
    } else if (agentConfig.bargeInSensitivity == 'MEDIUM') {
      bidiAdaptor.bargeInTranscriptsTrigger = 3;
      bidiAdaptor.bargeInMaxGapMs = 500;
    } else if (agentConfig.bargeInSensitivity == 'HIGH') {
      bidiAdaptor.bargeInTranscriptsTrigger = 1;
      bidiAdaptor.bargeInMaxGapMs = 1000;
    } else if (agentConfig.bargeInSensitivity == 'DISABLED') {
      bidiAdaptor.bargeInTranscriptsTrigger = -1;
    }
  }
  audioContextState.value = audioContext.state;
  audioContext.onstatechange = () => {
    audioContextState.value = audioContext.state;
  };
}

// Reactive Properties
const isConnected = ref(false);
const isResumedSession = ref(false);
const receivedTranscript = ref(null);
const imgUploadQueue = ref([]);
let toolMessageHold = false;
const toolMessageQueue = ref([]);
const talking = ref(!pushToTalk);
const lastUserUtterance = ref('');
const lastUtteranceInserted = ref(false);
const isConfigValid = ref(validateAgentConfig());
// If we do not receive any new transcripts past the defined delay, we flush the transcript.
let lastTranscriptTimeout = null;
const lastTranscriptDelay = 1500;
const disconnectReason = ref(null);
const functionCallInflight = ref(false);
let handoffInflight = ref(false);
const isAudioPlaying = ref(false);
const isSpacebarPressedForTalk = ref(false);
const needsUserInteractionToResume = ref(false);
const showUploadOverlay = ref(false);
const canTakePicture = ref(false);

let audioEnabled = ref(agentConfig.audioInputMode !== 'NONE' && agentConfig.audioOutputMode !== 'DISABLED' && agentConfig.audioOutputMode !== 'DEFAULT_OFF');
const displayMuteButton = agentConfig.audioInputMode !== 'NONE' && agentConfig.audioOutputMode !== 'DISABLED' && agentConfig.audioOutputMode !== 'ALWAYS_ON';
const isCallMode = ref(agentConfig.modality === 'call');

// Template Refs
const messageBox = useTemplateRef('message-box');
const userInput = useTemplateRef('user-input');

let reconnectButtonText = 'Start conversation';

// Web stream and Audio Context
let bidiStream = null;
let reconnectAttempts = 0;
let reconnectTimeout = null;

// Utilities
let router = null; // TODO: see is this is needed

// Computed Properties
const connectedMode = computed(() => {
  const audioReady = agentConfig.audioInputMode === 'NONE' || (audioContext && audioContextState.value === 'running') || isResumedSession.value;
  return (isConnected.value && (accessToken.value || agentConfig.apiUri) && audioReady) || ['SERVER_DROP', 'DISCONNECT_WAITING'].includes(disconnectReason.value);
});

const lastRichContentMessageIndex = computed(() => {
  if (!messages.value) return -1;
  for (let i = messages.value.length - 1; i >= 0; i--) {
    if (messages.value[i].payload?.html) {
      return i;
    }
  }
  return -1;
});

const lastBotMessageIndex = computed(() => {
  if (!messages.value) return -1;
  for (let i = messages.value.length - 1; i >= 0; i--) {
    if (messages.value[i].actor === 'BOT' && messages.value[i].text) {
      return i;
    }
  }
  return -1;
});

// Get the last message from the messages array matching a filter
function getLastMessage(filter) {
  if (!messages.value || messages.value.length === 0) return undefined;

  const filterKeys = Object.keys(filter);
  if (filterKeys.length === 0) return messages.value[messages.value.length - 1];

  for (let i = messages.value.length - 1; i >= 0; i--) {
    if (filterKeys.length > Object.keys(messages.value[i]).length) continue;

    for (const key of filterKeys) {
      // eslint-disable-next-line no-prototype-builtins
      if (!messages.value[i].hasOwnProperty(key) || filter[key] !== messages.value[i][key]) {
        continue;
      }
    }
    return messages.value[i];
  }
  return undefined;
}

const inputPlaceholderText = ref(agentConfig.inputPlaceholderText || 'What do you need help with?');

watch(chatUiStatus, (newStatus) => {
  if (newStatus === 'expanded') {
    nextTick(() => {
      if (messageBox.value) {
        messageBox.value.scrollTop = messageBox.value.scrollHeight;
      }
    });
  }
});

watch([currentUserInput, userInput], () => {
  if (userInput.value) {
    const messages = messageBox.value;
    // Check if the user is scrolled to the bottom before resizing the textarea.
    // We add a small buffer (1px) to account for potential sub-pixel rendering issues.
    const isScrolledToBottom = messages.scrollHeight - messages.scrollTop <= messages.clientHeight + 1;

    const textarea = userInput.value;
    textarea.style.height = 'auto'; // Temporarily shrink to get the correct scrollHeight
    textarea.style.height = `${textarea.scrollHeight}px`;

    // Only show the scrollbar when the content exceeds the max-height
    const hasOverflow = textarea.scrollHeight > textarea.clientHeight;
    textarea.style.overflowY = hasOverflow ? 'auto' : 'hidden';

    if (isScrolledToBottom) {
      messages.scrollTop = messages.scrollHeight;
    }
  }
});

const allowInput = computed(() => {
  return connectedMode.value && !functionCallInflight.value && !handoffInflight.value;
});

const allowUploads = computed(() => {
  return (bidiAdaptor instanceof BidiRunSessionAdaptor || bidiAdaptor instanceof RunSessionAdaptor) &&
    allowInput.value && !agentConfig.disableImageUploads &&
    imgUploadQueue.value.length < agentConfig.imageUploadMaxNumber;
});

const showMicButton = computed(() => {
  return agentConfig.audioInputMode === 'DEFAULT_ON' || agentConfig.audioInputMode === 'DEFAULT_OFF';
});

const disconnectReasonDescription = computed(() => {
  switch (disconnectReason.value) {
  case 'USER_REQUESTED':
    return 'You ended the conversation.';
  case 'AGENT_REQUESTED':
    return 'The agent ended the conversation.';
  case 'HARD_HANDOVER':
    return 'The agent requested an escalation to a human representative. This ends the conversation from the virtual agent\'s perspective';
  default:
    return 'The session ended unexpectedly.';
  }
});

const agentEnv = computed(() => {
  if (agentConfig.environment === 'dev') {
    return 'dev';
  }
  return 'prod';
});

// Initialize function handler
const functionToolHandler = new FunctionToolHandler(bidiAdaptor.location, bidiAdaptor.projectId, bidiAdaptor.agentId, bidiAdaptor.sessionId, accessToken.value, router);
const registerClientSideFunction = functionToolHandler.registerClientSideFunction.bind(functionToolHandler);

// Helper Functions
function setTalkingMode(talkingMode) {
  if (talkingMode && audioContext?.state !== 'running') {
    audioContext.resume();
  }
  talking.value = talkingMode;
}

function validateAgentConfig() {
  // Rule 1: 'call' style requires audio input
  if (agentConfig.audioInputMode === 'NONE' && agentConfig.modality === 'call') {
    insertErrorMessage('The web component was configured in call mode but does not allow audio input. Please correct the configuration and try again.<br/>' +
      '<span style="color: #747775;">See the <a href="https://cloud.google.com/customer-engagement-ai/conversational-agents/ps/deploy/web-widget" target="_blank" style="color: #747775;">documentation</a> for more information.</span>', true);
    return false;
  }

  // Future validation rules here
  // ...

  return true;
}

function insertLastUtterance() {
  if (!lastUtteranceInserted.value && !!lastUserUtterance.value) {
    lastUserUtterance.value = '';
    lastUtteranceInserted.value = true;
  }
};

// Once all transcript parts have been received, we move the transcript from the
// user input area to the messages stack as a USER message.
function flushTranscript() {
  if (receivedTranscript.value?.transcript) {
    insertMessage('USER', { text: receivedTranscript.value.transcript });
  }
  insertLastUtterance();
  receivedTranscript.value = null;
  currentUserInput.value = '';
}

function liveUserUtterance() {
  let result = lastUserUtterance.value;
  if (receivedTranscript.value?.type === 'TRANSCRIPT') {
    result = receivedTranscript.value.transcript || '';
    // Some transcripts are self contained, while other are increments on the previous transcript
    if (agentConfig.enableLiveTranscription) {
      currentUserInput.value = result;
    } else if (lastUserUtterance.value == null || !receivedTranscript.value.partial) {
      lastUserUtterance.value = result;
    } else {
      lastUserUtterance.value += result;
    }

    nextTick().then(() => {
      // make sure any time we update the <input> with a new transcript
      // we also scroll it to the right so text remains visible
      if (userInput.value) userInput.value.scrollLeft = userInput.value.scrollWidth;
    });
  } else if (receivedTranscript.value?.payload?.messageType === 'SPEECH_ACTIVITY_END') {
    insertLastUtterance();
  }
};

// --------------------- Message stack ---------------------

function insertMessage(actor, value, fullPayload) {
  const messageId = getNextMessageId();

  // Remove any previous message with the same HTML payload
  if (value.replace) {
    const existingAuthMessageIndex = messages.value.findIndex(m => (
      m.actor === actor &&
      (m.payload?.html === value.payload.html || m.text === value.text)
    ));
    if (existingAuthMessageIndex > -1) messages.value.splice(existingAuthMessageIndex, 1);
  }

  const message = { messageId, actor, ...value };

  if (message.text || message.payload?.html) {
    if (message.actor === 'BOT') {
      // get the last message from the BOT, with matching turnIndex, if it exists
      const lastMessageFilter = { actor: 'BOT' };
      if (message.turnIndex) lastMessageFilter.turnIndex = message.turnIndex;
      let lastMessage = getLastMessage(lastMessageFilter);

      if (message.partial == undefined && message.turnIndex && lastMessage && message.turnIndex == lastMessage.turnIndex) {
        message.partial = true;
      }

      if (lastMessage != undefined && (lastMessage.partial || (message.turnIndex != undefined && message.turnIndex == lastMessage.turnIndex))) {
        if (message.partial) {
          lastMessage.text += message.text;
        } else {
          lastMessage.text = message.text;
          lastMessage.partial = false;
        }
      } else {
        messages.value.push(message);
      }

      // Take the last message again, and parse it, if it looks like markdown
      lastMessage = getLastMessage({ actor: 'BOT' });
      if (lastMessage && lastMessage.text &&
        (lastMessage.text.includes('* ') || lastMessage.text.includes('**'))) {
        lastMessage.html = marked.parse(lastMessage.text);
      }
    } else {
      messages.value.push(message);
    }
  }
  nextTick(() => {
    if (messageBox.value) {
      messageBox.value.scrollTop = messageBox.value.scrollHeight;
    }
  });
  const eventName = (actor === 'USER') ? 'message sent' : 'message received';
  saveStateToSession();
  logger.info({ message: value.text, event: eventName, payload: fullPayload || value }, `${actor.toLowerCase()}-message`);
  return messageId;
};

function insertRichMessage(templateId, context, contentType=undefined, renderOptions=undefined) {
  context.cesMessageId = getNextMessageId();
  const rendered = renderTemplate(templateId, context);
  if (!rendered) return false;
  const payload = { html: rendered, templateId: templateId, context: context};
  if (contentType) payload.contentType = contentType;
  if (renderOptions) payload.renderOptions = renderOptions;
  insertMessage('BOT', { payload: payload });
  return true;
}

function insertErrorMessage(message, clearMessages = false) {
  if (agentConfig.showErrorMessages) {
    if (clearMessages) clearErrorMessages();
    insertMessage('BOT', {
      payload: {
        html: `<div style="color: #eb5555; background-color: #ffedc0; padding: 10px; border-radius: 10px; padding: 1em;">${message}<br/>` +
          '<hr  style="height:1px;border-width:0;color:#a49b9b;background-color:#a49b9b"/>' +
          '<span style="color: #a49b9b;""><small>To disable these messages, remove the \'<span style="font-family:monospace;">show-error-messages</span>\' setting from the web widget configuration.</small></span></div>'
      }, msg_type: 'ERROR_MESSAGE'
    });
  }
}

function getNextMessageId() {
  return `${bidiAdaptor.sessionId}-${messages.value.length + 1}`;
}

function clearErrorMessages() {
  messages.value = messages.value.filter(m => m.msg_type !== 'ERROR_MESSAGE');
}

// --------------------- Message handling ---------------------

function sendQueryParams() {
  if (queryVars && Object.keys(queryVars).length > 0) {
    const message = bidiAdaptor.marshallMessage(
      { type: 'VARS', payload: queryVars });
    if (message) sessionInput(message);
    queryVars = {};
  }
}

async function sessionInput(input) {
  if (input === undefined || input === null) {
    Logger.warn('ignoring invalid sessionInput message:', input);
    return;
  }
  // Ensure input is either a string or an object (already checked for null/undefined)
  if (typeof input !== 'string' && typeof input !== 'object') {
    Logger.warn('ignoring invalid sessionInput message: input must be a string or an object, received:', typeof input, input);
    return;
  }

  // Try to identify known marshalled objets
  let marshalled = undefined;
  if (typeof input === 'object' && (input.realtimeInput || input.config)) {
    marshalled = input;
  } else {
    // If we receive a string, we consider this to be a plain text message
    const inputs = typeof input === 'string' ? { text: input } : input;

    // See if we have received any unmarshalled data
    const unmarshalled = { type: 'SESSION_INPUT', payload: {} };
    if (inputs.text && inputs.text.length > 0) {
      unmarshalled.payload.text = inputs.text;
    }
    if (inputs.images && inputs.images.length > 0) {
      unmarshalled.payload.images = inputs.images;
    }
    if (inputs.vars && Object.keys(inputs.vars).length > 0) {
      unmarshalled.payload.vars = inputs.vars;
    } else if (queryVars && Object.keys(queryVars).length > 0) {
      unmarshalled.payload.vars = JSON.parse(JSON.stringify(queryVars));
      queryVars = {};
    }
    if (Object.keys(unmarshalled.payload).length > 0) {
      marshalled = bidiAdaptor.marshallMessage(unmarshalled);
    }
  }

  if (!marshalled) marshalled = input;

  // If in connectionless mode (RunSession), check that the token is still valid
  // before sending a message
  if (bidiStream.connectionless && !isTokenValid()) {
    await refreshToken();
    // update the token of the RunSession bidiStrem (since it needs the token on
    // every request, and never disconnects)
    if (bidiStream instanceof HttpRequestResponseStream) bidiStream.accessToken = accessToken.value;
  }

  const messages = Array.isArray(marshalled) ? marshalled : [marshalled];
  for (const message of messages) {
    bidiStream.sendMessage(JSON.stringify(message));

    // Look for custom events to trigger
    const inputs = message.inputs || [];
    const eventsToSend = new Set();
    const inputMapping = {
      text: 'ces-text-sent',
      image: 'ces-image-sent',
      payload: 'ces-payload-sent',
      toolResponses: 'ces-tool-response-sent'
   }
    for (const input of inputs) {
      for (const [key, value] of Object.entries(inputMapping)) {
        if (input[key]) {
          eventsToSend.add(value);
        }
      }
    }

    window.dispatchEvent(new CustomEvent('ces-message-sent', { detail: message }));
    for (const eventId of eventsToSend) {
      window.dispatchEvent(new CustomEvent(eventId, { detail: message }));
    }
  }
};

function sendConfig() {
  if (bidiStream instanceof HttpRequestResponseStream) return;

  let configToken = null;

  if (bidiStream instanceof WebsocketBidiStream && accessToken.value) {
    configToken = accessToken.value;
  }

  // Write the config message in the logs without the accessToken
  Logger.log(`Sending config message: ${JSON.stringify(bidiAdaptor.getConfigMessage(agentConfig, null))}`);

  // Send the config message. If using websockets, the accessToken will be added to the message
  sessionInput(bidiAdaptor.getConfigMessage(agentConfig, configToken));
};

// --------------------- Client-side function tools ---------------------

const processToolCallMessage = async (toolCallMessage) => {
  const toolId = {
    toolName: toolCallMessage.tool,
    toolDisplayName: toolCallMessage.displayName
  };
  const toolCallId = toolCallMessage.id;
  const toolInput = toolCallMessage.args;
  const toolResponse = await functionToolHandler.runFunctionTool(toolCallId, toolId, toolInput);
  return toolResponse;
};

// --------------------- Conversation Management ---------------------

// Empty audio to send in push-to-talk mode when the mic is off
const zeroFilledBuffer = new ArrayBuffer(4096);
const uint8Array = new Uint8Array(zeroFilledBuffer);
const emptyAudio = btoa(String.fromCharCode(...uint8Array));

const startConversation = async () => {

  // First, validate agent configuration
  if (!validateAgentConfig()) {
    return;
  }

  if (!isResumedSession.value && agentConfig.audioInputMode !== 'NONE' && audioContext.state !== 'running') {
    return;
  }

  // If no valid authentication found, add the auth button to the message stack
  if (!(await authenticate())) {
    if (agentConfig.oauthClientId) {
      const context = {
        image: 'https://www.google.com/images/branding/googleg/1x/googleg_standard_color_128dp.png',
        text: 'Sign-in with Google',
        onclick: `window.kite.googleOauthSignIn('${getNextMessageId()}')`
      }
      insertRichMessage('cesm_button', context);
      return;
    }
  }

  try {
    connectWebStream();

    if (agentConfig.audioInputMode !== 'NONE') {
      if (audioContext.state === 'suspended') {
        await audioContext.resume();
      }
      await audioRecorder.start();

      audioRecorder.on('data', (base64Data) => {
        if (bidiStream != null && bidiStream.isConnected()) {
          // If not talking (in push-to-talk mode, send empty audio instead of actual audio)
          if (!talking.value) {
            base64Data = emptyAudio;
            voiceDetected.value = false;
          } else {
            const now = Date.now();
            if (isVoiceActive(base64Data)) {
              lastVoiceDetected = now;
              voiceDetected.value = true;
            } else if (lastVoiceDetected && now - lastVoiceDetected > VAD_TIMEOUT) {
              voiceDetected.value = false;
            }
          }

          // Prepare the message payload
          const message = bidiAdaptor.marshallMessage(
            { type: 'AUDIO', payload: { audio: base64Data }, vars: queryVars });

          logger.info({ message: '<audio>', event: 'audio sent', payload: message }, 'user-message');
          // Send the message over the WebSocket
          sendQueryParams();
          sessionInput(message);
        }
      });
    }
  } catch (error) {
    Logger.error('Error starting recording:', error);
  }
};

function pauseConversation() {
  if (agentConfig.audioInputMode !== 'NONE') {
    audioStreamer.stop();
    audioRecorder.stop();
  }
};

async function endSession() {
  const sessionEndMessage = bidiAdaptor.endSession();
  if (sessionEndMessage) {
    sessionInput(sessionEndMessage);
  }
};

/**
 * Analyzes a base64 audio chunk to detect if it contains voice.
 * @param {string} base64Data The base64 encoded audio data.
 * @returns {boolean} `true` if voice is detected, otherwise `false`.
 */
function isVoiceActive(base64Data) {
  // Decode base64 to a byte array
  const binaryString = atob(base64Data);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }

  // Create a DataView to read 16-bit PCM samples
  const dataView = new DataView(bytes.buffer);
  const sampleCount = dataView.byteLength / 2;
  let sumOfSquares = 0;
  for (let i = 0; i < sampleCount; i++) {
    // Read a 16-bit sample and normalize it to a range of -1.0 to 1.0
    const sample = dataView.getInt16(i * 2, true) / 32768;
    sumOfSquares += sample * sample;
  }

  const rms = Math.sqrt(sumOfSquares / sampleCount);
  return rms > VAD_THRESHOLD;
}

// --------------------- Keyboard input ---------------------
async function submitUserInput() {
  const manualUtteranceText = currentUserInput.value;
  if (manualUtteranceText || imgUploadQueue.value.length > 0) {
    if (manualUtteranceText.startsWith('VARS=')) {
      try {
        setQueryParameters(JSON.parse(manualUtteranceText.substring(5)));
        currentUserInput.value = '';
        return;
      } catch (error) {
        Logger.error(`Error parsing query parameters ${manualUtteranceText.substring(5)}. Sending them as-is to agent.`, error);
      }
    }

    const images = [];
    if (imgUploadQueue.value.length > 0) {
      images.push(...imgUploadQueue.value);
      imgUploadQueue.value = [];
      let innerHtml = '';
      for (const image of images) {
        innerHtml += `<img src="${image}" style="width: 60px; height: 60px; border-radius: 8px; object-fit: cover;">`;
      }
      insertMessage('USER', { payload: { html: `<div style="display: flex; flex-wrap: wrap; gap: 4px;">${innerHtml}</div>` } });
    }

    lastUserUtterance.value = manualUtteranceText;
    if (manualUtteranceText.length > 0) {
      insertMessage('USER', { text: manualUtteranceText });
      insertLastUtterance();
    }
    await sessionInput({ text: manualUtteranceText, images: images });
    currentUserInput.value = '';
    nextTick(resetTextareaHeight);
    window.dispatchEvent(new CustomEvent('ces-user-input-entered', { detail: { input: manualUtteranceText } }));
    // If a response is playing, stop it
    if (isAudioPlaying.value) {
      audioStreamer.stop();
    }
  }

}
// UI Event Handlers
function processInputField(event) {
  if (event.key === 'Enter' && currentUserInput.value) {
    event.preventDefault();
    submitUserInput();
  }
}

function resetTextareaHeight() {
  if (userInput.value) {
    userInput.value.style.height = 'auto';
  }
}

// Keyboard event handlers for spacebar push-to-talk
function handleSpacebarDown(event) {
  // Check if pushToTalk is enabled, the key is Space, and the focus is not in the web component
  if (pushToTalk && event.code === 'Space' && event.target === document.body) {
    // Prevent default action (scrolling)
    event.preventDefault();
    // Only start talking if not already started by spacebar
    if (!isSpacebarPressedForTalk.value) {
      isSpacebarPressedForTalk.value = true;
      setTalkingMode(true);
    }
  }
};

function handleSpacebarUp(event) {
  // Check if pushToTalk is enabled, the key is Space, and the focus is not in the web component
  if (pushToTalk && event.code === 'Space' && event.target === document.body) {
    // Prevent default action (scrolling)
    event.preventDefault();
    // Only stop talking if it was started by spacebar
    if (isSpacebarPressedForTalk.value) {
      isSpacebarPressedForTalk.value = false;
      setTalkingMode(false);
    }
  }
};

async function resizeImage(file, maxWidth = 800, maxHeight = 800) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        let { width, height } = img;

        if (width > maxWidth || height > maxHeight) {
          if (width > height) {
            height = Math.round(height * (maxWidth / width));
            width = maxWidth;
          } else {
            width = Math.round(width * (maxHeight / height));
            height = maxHeight;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg'));
      };
      img.onerror = reject;
      img.src = e.target.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// Upload an image file when the user clicks on the plus button
// eslint-disable-next-line no-unused-vars
function uploadFile(event) {
  showUploadOverlay.value = !showUploadOverlay.value;
}

function triggerFileUpload() {
  showUploadOverlay.value = false;
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = 'image/*';
  input.multiple = true; // Allow multiple file selection
  input.onchange = async (event) => {
    const files = event.target.files;
    if (files.length > 0) {
      for (const file of files) {
        if (imgUploadQueue.value.length >= agentConfig.imageUploadMaxNumber) {
          Logger.warn('maximum number of image uploads reached. Ignoring image.');
          continue;
        }
        try {
          const resizedImageDataUrl = await resizeImage(file, agentConfig.imageUploadMaxWidth, agentConfig.imageUploadMaxHeight);
          imgUploadQueue.value.push(resizedImageDataUrl);
        } catch (error) {
          Logger.error('Error resizing image:', error);
          // Optionally, handle the error, e.g., by notifying the user
        }
      }
    }
  };
  input.click();
}

function triggerCameraCapture() {
  if (imgUploadQueue.value.length >= agentConfig.imageUploadMaxNumber) {
    Logger.warn('maximum number of image uploads reached. Ignoring image.');
    return;
  }
  showUploadOverlay.value = false;
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = 'image/*';
  input.capture = 'user'; // 'environment' would be for the back camera
  input.onchange = async (event) => {
    const files = event.target.files;
    if (files.length > 0) {
      // Typically the camera will only provide one file
      const file = files[0];
      try {
        const resizedImageDataUrl = await resizeImage(file);
        imgUploadQueue.value.push(resizedImageDataUrl);
      } catch (error) {
        Logger.error('Error processing image from camera:', error);
      }
    }
  };
  input.click();
}

function removeImage(index) {
  imgUploadQueue.value.splice(index, 1);
}

// --------------------- Audio streamer ---------------------
if (agentConfig.audioInputMode !== 'NONE') {
  audioStreamer.onComplete = () => {
    isAudioPlaying.value = false;
    if (disconnectReason.value) {
      pauseConversation();
      if (bidiStream && bidiStream.isConnected()) disconnectWebStream(disconnectReason.value);
    }
  };
}

function stopCapturingAudio() {
  setTalkingMode(false);
};

watch(talking, (value) => {
  if (value) {
    audioStreamer.stop();
  }
});

function toggleAudioOutput(newValue) {
  if (typeof newValue != 'boolean') audioEnabled.value = !audioEnabled.value;
  else audioEnabled.value = newValue;
  if (!audioEnabled.value) {
    audioStreamer.stop();
  }
}

// --------------------- Page dynamics ---------------------

onMounted(async () => {

  loadStateFromSession();
  window.addEventListener('beforeunload', saveStateToSession);
  if (pushToTalk) {
    window.addEventListener('keydown', handleSpacebarDown);
    window.addEventListener('keyup', handleSpacebarUp);
  }

  if (displayMuteButton.value) {
    if (agentConfig.audioOutputMode === 'DEFAULT_OFF') {
      toggleAudioOutput(false);
    } else if (agentConfig.audioOutputMode === 'DEFAULT_ON') {
      toggleAudioOutput(true);
    }
  }

  if (chatUiStatus.value === 'expanded') {
    // Scroll to bottom if we are already expanded (e.g. from session restore)
    nextTick(() => {
      if (messageBox.value) {
        messageBox.value.scrollTop = messageBox.value.scrollHeight;
      }
    });
    if (await authenticate()) {
      if (isResumedSession.value && agentConfig.audioInputMode !== 'NONE' && audioContext?.state !== 'running') {
        needsUserInteractionToResume.value = true;
      } else {
        startConversation();
      }
    } else if (agentConfig.oauthClientId) {
      startConversation();
    }
  }

  if (navigator.mediaDevices && navigator.mediaDevices.enumerateDevices) {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const isMobile = /Mobi/i.test(navigator.userAgent);
      canTakePicture.value = isMobile && devices.some(device => device.kind === 'videoinput');
    } catch (error) {
      Logger.warn('Could not detect camera:', error);
    }
  }

  // TODO: find a better way to ensure fuctions are exposed
  setTimeout(() => {
    window.dispatchEvent(new CustomEvent('ces-messenger-loaded'));
  }, 100);
});
onUnmounted(() => {
  window.removeEventListener('beforeunload', saveStateToSession);

  if (pushToTalk) {
    window.removeEventListener('mouseup', stopCapturingAudio);
    window.removeEventListener('keydown', handleSpacebarDown);
    window.removeEventListener('keyup', handleSpacebarUp);
  }
  if (bidiStream != null && bidiStream.isConnected()) {
    disconnectWebStream();
  }
});

function open() {
  chatUiStatus.value = 'expanded';
  startConversation();
  window.dispatchEvent(new CustomEvent('ces-chat-open-changed', { detail: { isOpen: true } }));
};

function close() {
  let shouldClose = true;
  if (cesmHooks['before-chat-panel-close']) {
    shouldClose = cesmHooks['before-chat-panel-close']();
  }

  if (shouldClose) {
    chatUiStatus.value = 'collapsed';
    if (isAudioPlaying.value) audioStreamer.stop();
    window.dispatchEvent(new CustomEvent('ces-chat-open-changed', { detail: { isOpen: false } }));
  }
};

function reconnect() {
  // If last attempt was in error, clear the local storage
  if (messages.value.length > 0 && messages.value[messages.value.length - 1].msg_type === 'ERROR_MESSAGE') {
    Logger.log('Clearing local storage before next connection attempt.');
    if (bidiAdaptor) bidiAdaptor.endSession();
    clearStorage({ clearAuthentication: true });
    messages.value = [];
  }

  const start = () => {
    needsUserInteractionToResume.value = false;
    startConversation();
  };

  if (agentConfig.audioInputMode !== 'NONE' && audioContext?.state !== 'running') {
    audioContext.resume().then(start);
  } else {
    start();
  }
}

function saveStateToSession() {
  const state = {
    messages: messages.value.filter(m => m.msg_type !== 'ERROR_MESSAGE'),
    sessionId: bidiAdaptor.sessionId,
    chatUiStatus: chatUiStatus.value,
    toolMessageQueue: toolMessageQueue.value
  };
  sessionStorage.setItem(BIDI_WIDGET_SESSION_KEY, JSON.stringify(state));
  logger.info({ event: 'session-saved' });
};

function loadStateFromSession() {
  const savedState = sessionStorage.getItem(BIDI_WIDGET_SESSION_KEY);
  if (savedState) {
    try {
      const state = JSON.parse(savedState);
      messages.value = state.messages || [];
      bidiAdaptor.sessionId = state.sessionId;
      chatUiStatus.value = state.chatUiStatus || (agentConfig.autoOpenChat ? 'expanded' : 'collapsed');
      toolMessageQueue.value = state.toolMessageQueue || [];
      isResumedSession.value = true;
      logger.info({ event: 'session-loaded', sessionId: state.sessionId });
    } catch (e) {
      Logger.error('Could not parse saved session state.', e);
      sessionStorage.removeItem(BIDI_WIDGET_SESSION_KEY);
    }
  } else {
    isResumedSession.value = false;
  }
};

function clearStorage(args) {
  sessionStorage.removeItem(BIDI_WIDGET_SESSION_KEY);
  messages.value = [];
  if (args && args.clearAuthentication) signOut();
}

function holdToolResponses() {
  toolMessageHold = true;
}

function flushToolResponses() {
  if (isConnected.value && toolMessageQueue.value.length > 0) {
    Logger.log('sending held messages:', toolMessageQueue.value);
    while (toolMessageQueue.value.length > 0) {
      const message = toolMessageQueue.value.shift();
      sessionInput(message);
    }
  }
  toolMessageHold = false;
}

// --------------------- Message templates ---------------------

const richMessageHandlers = [
  {
    template: 'cesm_button',
    event: 'click',
    handler: buttonTemplateHandler
  },
  {
    template: 'cesm_mcq',
    event: 'click',
    handler: listTemplateHandler
  }
]

function registerRichMessageHandler(templateId, handler, contentType=undefined, eventName='click') {
  const index = richMessageHandlers.findIndex(h =>
    h.template === templateId &&
    h.event === eventName &&
    h.contentType === contentType
  );

  const newHandler = { template: templateId, event: eventName, handler };
  if (contentType) {
    newHandler.contentType = contentType;
  }

  if (index !== -1) {
    richMessageHandlers[index] = newHandler;
  } else {
    richMessageHandlers.push(newHandler);
  }
}

function getRichTextHandler(templateId, eventName, contentType) {
  let candidate = undefined;
  for (const handler of richMessageHandlers) {
    if (handler.template === templateId && handler.event === eventName) {
      if (handler.contentType !== undefined) {
        // An exact match was found for this templateId/eventName/contentType combination
        if (handler.contentType.toLowerCase()  === contentType) return handler.handler;
      } else {
        // Fall back to the default handler for this templateId/eventName combination
        candidate = handler.handler;
      }
    }
  }
  if (candidate === undefined){
    Logger.log(`no '${eventName}' handler found for template '${templateId}'`);
  }
  return candidate;
}

function handleMessageClick(event, message, index) {
  if (!message.payload) return;

  const clickedElement = event.target;
  const templateId = message.payload.templateId;
  const contentType = message.payload.contentType !== undefined ? message.payload.contentType.toLowerCase() : '';
  const handler = getRichTextHandler(templateId, 'click', contentType);

  if (handler) {
    const result = handler(message, clickedElement);
    // renderOptions.onclick overrides action provided by handler
    let action = message.payload.renderOptions?.onclick || result.action;
    // only possible action today is 'delete'
    if (action === 'delete') {
      // Also delete the agent confirmation message, if any
      let messagesToDelete = 1;
      if (messages.value.length > index + 1 &&
          messages.value[index+1].actor === 'BOT') {
        messagesToDelete++;
      }
      messages.value.splice(index, messagesToDelete);
      saveStateToSession();
    }
  }
}

function buttonTemplateHandler(message, clickedElement) {
  const context = message.payload?.context;
  // If an onclick action was defined in the context, use it instead of sending a message
  if (context && !context.onclick) {    
    const sendMessage = context.userMessage || context.text;
    if (!context.mute) insertMessage('BOT', { text: sendMessage });
    if (sendMessage) sessionInput(sendMessage);
  }
  return { action: 'delete'}
}

function listTemplateHandler(message, clickedElement) {
  const context = message.payload?.context;
  const optionItem = clickedElement.closest('.option-item');

  if (optionItem && context) {
    const index = optionItem.dataset.index;
    const selectedOption = context.options[index];
    // If an onclick action was defined in the context, use it instead of sending a message
    if (selectedOption && !selectedOption.onclick) {
      const messageToSend = selectedOption.userMessage || selectedOption.title;
      insertMessage('USER', { text: messageToSend });
      sessionInput(messageToSend);
    }
  }
  return { action: 'delete'}
}

// --------------------- Bidi Webstream ---------------------

function getWebStreamEventListeners() {
  return {
    onConnecting: () => {
      Logger.log('Connecting...');
    },
    onOpen: async () => {
      isConnected.value = true;
      disconnectReason.value = null;
      reconnectButtonText = 'Resume conversation';
      sendConfig();
      if (!toolMessageHold) flushToolResponses();

      // Send the first message, if any, but only if the message stack is empty
      if (agentConfig.initialMessage != '' && messages.value.length == 0) {
        sessionInput(agentConfig.initialMessage);
        if (!agentConfig.hideInitialMessage) insertMessage('USER', { text: agentConfig.initialMessage });
      }
      window.dispatchEvent(new CustomEvent('ces-messenger-connected'));
      reconnectAttempts = 0;
    },
    // eslint-disable-next-line no-unused-vars
    onClose: (event) => {
      if (!(['USER_REQUESTED', 'AGENT_REQUESTED', 'HARD_HANDOVER', 'AUTHENTICATION_ERROR'].includes(disconnectReason.value))) disconnectReason.value = 'UNKNOWN';

      if (bidiStream && !bidiStream.connectionless) isConnected.value = false;

      if (disconnectReason.value === 'UNKNOWN') {
        Logger.warn('BidiStream disconnected.');
        // Try to reconnect a few times before giving up
        if (reconnectAttempts < RECONNECT_MAX_ATTEMPS) {
          reconnectAttempts++;
          const reconnectDelay = RECONNECT_DELAY*(RECONNECT_DELAY_MULTIPLIER*reconnectAttempts);
          Logger.log(`Attempting reconnection in ${reconnectDelay/1000} seconds...`);
          if (reconnectTimeout) clearTimeout(reconnectTimeout);
          reconnectTimeout = setTimeout(reconnect, reconnectDelay);
        } else {
          Logger.warn('Maximum number of reconnect attempts reached.');
          reconnectAttempts = 0;
        }
      }
      window.dispatchEvent(new CustomEvent('ces-messenger-disconnected', { detail: { disconnectReason: disconnectReason.value } }));
    },
    onError: (error) => {
      Logger.error('BidiStream error:', error);
      insertErrorMessage(`BidiStream error: ${error.message}`);
      insertMessage('BOT', { text: 'I\'m sorry, I couldn\'t send your message. Please try again.' });

      if (!bidiStream.connectionless) {
        isConnected.value = false;
        bidiStream = null;
      }
    },
    onMessage: async (inMessage) => {
      try {
        // Call the response-received hook if it exists as a function and the message is not audio
        if (typeof cesmHooks['response-received'] === 'function') {
          // Ignore audio messages, sice they are too chatty
          if (!(inMessage.sessionOutput && inMessage.sessionOutput.audio !== undefined)) {
            // The hook can cancel the message if it returns false
            if (!cesmHooks['response-received'](inMessage)) return;
          }
        }

        let receivedMessages;
        const eventsToSend = new Set();
        const outputMapping = {
          TEXT: 'ces-text-received',
          TRANSCRIPT: 'ces-transcript-received',
          PAYLOAD: 'ces-payload-received',
          TOOL_CALL: 'ces-tool-call-received'
      }        

        // Start by handling websockets disconnect messages that are independent from the API
        if (inMessage.connection_closed) {
          const unifiedMessage = {
            type: 'CONTROL_SIGNAL',
            agentDisconnect: true,
            disconnectReason: 'CONNECTION_ERROR'
          };

          if (inMessage.reason &&
            (inMessage.reason.toLowerCase().includes('permission') ||
              inMessage.reason.toLowerCase().includes('authentication') ||
              inMessage.reason.toLowerCase().includes('denied'))) {
            unifiedMessage.disconnectReason = 'AUTHENTICATION_ERROR';
            window.dispatchEvent(new CustomEvent('ces-authentication-error'));
            signOut();
          }

          receivedMessages = [unifiedMessage];
        } else {
          receivedMessages = bidiAdaptor.unmarshallMessage(inMessage);
        }

        for (const message of receivedMessages) {
          if (message.type != 'AUDIO') {
            eventsToSend.add('ces-message-received');
            for (const [key, value] of Object.entries(outputMapping)) {
              if (message.type === key) {
                eventsToSend.add(value);
              }
            }
          }

          if (message.type === 'AUDIO') {
            if (audioEnabled.value && chatUiStatus.value !== 'collapsed') {
              audioStreamer.addChunk(message.audio);
              if (message.sampleRateHertz && audioContext.sampleRate !== message.sampleRateHertz) {
                Logger.warn(`AudioContext sample rate (${audioContext.sampleRate}) does not match audio message sample rate: ${message.sampleRateHertz}`);
              }
              audioStreamer.play();
              isAudioPlaying.value = true;
            }
            logger.info({ message: '<audio>', event: 'audio received', payload: inMessage }, 'bot-message');
          } else if (message.type === 'TEXT') {
            // Polysynth and ADK do not indicate when a transcript is final
            // if we receive a message coming from the BOT, we flush the transcript.
            if (receivedTranscript.value != null) flushTranscript();

            let pushMessage = true;
            // In passthrough mode, if message is empty (or only whitespaces) or if message response type is FINAL, don't insert it
            // This is because duplicates are being sent currently and responses marked with a response type are often delayed for unreasonably long periods
            if (agentConfig.streamingMode === 'STREAMING_MODE_PASSTHROUGH') {
              if ((!!message.text && !message.text.replaceAll(' ', '')) || message.responseType === 'FINAL') {
                Logger.log('response type FINAL skipped:', message.text);
                pushMessage = false;
              }
            }
            if (pushMessage) {
              const msgToInsert = { text: message.text };
              if (message.turnIndex) msgToInsert.turnIndex = message.turnIndex;

              if (message.partial != undefined) msgToInsert.partial = message.partial;
              insertMessage('BOT', msgToInsert, inMessage);
            }

            lastUtteranceInserted.value = false;
            lastUserUtterance.value = '';
          } else if (message.type === 'TRANSCRIPT') {
            // New transcript received. Resetting flush timeout.
            clearTimeout(lastTranscriptTimeout);

            if (!message.partial || receivedTranscript.value == null) {
              receivedTranscript.value = message;
            } else {
              receivedTranscript.value.transcript += message.transcript;
            }

            // Update input field with last utterance
            liveUserUtterance();

            if (message.interruptionSignal && isAudioPlaying.value) {
              audioStreamer.stop();
            }

            // BidiSDI indicates when a transcript is final
            if (message.isFinal) {
              flushTranscript();
            } else {
              // Flush the transcript after the specified delay, if no
              // new transcript is received.
              lastTranscriptTimeout = setTimeout(() => {
                flushTranscript();
              }, lastTranscriptDelay);
            }

          } else if (message.type === 'TOOL_CALL') {
            const toolId = {
              toolName: message.toolCall.tool,
              toolDisplayName: message.toolCall.displayName
            };
            // If the tool is not registered but has 'template_id' and 'context' args, insert a rich text message
            if (!functionToolHandler.isRegisteredFunction(toolId) && message.toolCall?.args &&
                message.toolCall.args.template_id && message.toolCall.args.context) {
              Logger.debug(`Inserting rich text message with template "${message.toolCall.args.template_id}"`);
              const toolResponse = message.toolCall;
              toolResponse.response = {status: 'success'};
              if (!insertRichMessage(message.toolCall.args.template_id,
                                         message.toolCall.args.context,
                                         message.toolCall.args.content_type,
                                         message.toolCall.args.render_options)) {
                toolResponse.response.status = 'error';
              }
              delete toolResponse.args;
              const marshalledMessage = bidiAdaptor.marshallMessage({
                type: 'TOOL_RESPONSE',
                payload: toolResponse
              });
              sessionInput(marshalledMessage);
            } else {
              Logger.debug('Calling client function tool', message.toolCall);
              const toolResponse = await processToolCallMessage(message.toolCall);
              // send tool response back to agent HERE
              Logger.debug('Tool responded with payload', { toolResponse });
              const marshalledMessage = bidiAdaptor.marshallMessage({
                type: 'TOOL_RESPONSE',
                payload: toolResponse
              });
              if (toolMessageHold) {
                Logger.debug('Holding tool response message', marshalledMessage);
                toolMessageQueue.value.push(marshalledMessage);
                saveStateToSession();
              } else {
                Logger.debug('Returning tool response message to the backend', marshalledMessage);
                sessionInput(marshalledMessage);
              }
            }
          } else if (message.type === 'CONTROL_SIGNAL' && message.agentDisconnect) {
            if (message.disconnectReason) {
              disconnectReason.value = message.disconnectReason;
            }
            // Only disconnect if there is no audio playing, otherwise wait for audio to complete.
            if (!isAudioPlaying.value) {
              pauseConversation();
              disconnectWebStream(message.disconnectReason);
            }
          } else if (message.type === 'CONTROL_SIGNAL' && message.interruptionSignal) {
            Logger.debug('barge-in received');
            // Barge-in handling. Stop audio playback.
            if (isAudioPlaying.value) {
              audioStreamer.stop();
            }
          }
        }

        // Trigger the custom events identified in this message
        for (const eventId of eventsToSend) {
          window.dispatchEvent(new CustomEvent(eventId, { detail: inMessage }));
        }
      } catch (error) {
        Logger.error('Error processing message:', error);
      }
    },
    // eslint-disable-next-line no-unused-vars
    onMessageSent: (event) => {
      // Maybe do something here
    }
  };
}

// --- Web Stream Actions ---
function connectWebStream() {

  // If we do not have an access token at this point, and none of the possible
  // token creators are configured, we may have a config problem.
  if (!accessToken.value && agentConfig.tokenBrokerUrl == undefined && agentConfig.oauthClientId == undefined && agentConfig.apiUri == undefined) {
    insertErrorMessage('One of the following is required to authenticate with the agent: <ul>' +
      '<li><span style="font-family:monospace;">token-broker-url</span></li>' +
      '<li><span style="font-family:monospace;">oauth-client-id</span></li>' +
      '<li><span style="font-family:monospace;">api-uri</span></li>' +
      '</ul>' +
      'Alternatively, you can use the <span style="font-family:monospace;">setAccessToken</span> function to pass a valid token to the agent.<br/>' +
      '<span style="color: #747775;">See the <a href="https://cloud.google.com/customer-engagement-ai/conversational-agents/ps/deploy/web-widget" target="_blank" style="color: #747775;">documentation</a> for more information.</span>', true);
    return false;
  }

  try {
    Logger.log(`Initializing WebStream with agentId: ${bidiAdaptor.appString}`);
    if (agentConfig.audioInputMode == 'NONE') {
      bidiStream = new HttpRequestResponseStream(agentEnv.value, bidiAdaptor.appString, getWebStreamEventListeners, bidiAdaptor.sessionId, agentConfig.apiUri || null);
    } else
      if (!websocketUri) {
        bidiStream = new WebchannelBidiStream(agentEnv.value, bidiAdaptor.appString, getWebStreamEventListeners);
      } else {
        bidiStream = new WebsocketBidiStream(websocketUri, bidiAdaptor.appString, getWebStreamEventListeners);
      }
  } catch (e) {
    Logger.error('Failed to initialize WebStream:', e);
    bidiStream = null;
    return;
  }

  if (bidiStream instanceof WebsocketBidiStream || !accessToken.value) {
    bidiStream.connect();
  } else {
    bidiStream.connect(accessToken.value);
  }
}

function disconnectWebStream(reason) {
  if (reason) disconnectReason.value = reason;
  sessionStorage.removeItem(BIDI_WIDGET_SESSION_KEY);
  if (bidiStream) bidiStream.disconnect();
}

// --------------------- Authentication ---------------------

function registerHook(eventName, callback) {
  cesmHooks[eventName] = callback;
}

function createDomHintTracker(config) {
  return new DomHintTracker({ ...config, setQueryParameters });
}

defineExpose({
  clearStorage,
  close,
  disconnectWebStream,
  endSession,
  holdToolResponses,
  flushToolResponses,
  getRichTextHandler,
  insertMessage,
  insertRichMessage,
  open,
  pauseConversation,
  createDomHintTracker,
  registerClientSideFunction,
  registerRichMessageHandler,
  registerHook,
  registerTemplate,
  sessionInput,
  setAccessToken,
  setQueryParameters,
  signOut
});

// Global functions
window.kite.sessionInput = sessionInput;
window.kite.googleOauthSignIn = googleOauthSignIn;
window.kite.insertMessage = insertMessage;
window.kite.insertRichMessage = insertRichMessage;
window.kite.insertErrorMessage = insertErrorMessage;

</script>
<style scoped>
/* CSS Reset start */
:host {
  display: block;
  box-sizing: border-box;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
  font-size: 16px;
  line-height: 1.5;
  color: #213547;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  --primary-color: var(--host-primary-color, #42b883);
}

*,
*::before,
*::after {
  box-sizing: inherit;
}

h1,
h2,
h3,
h4,
h5,
h6,
p,
ul,
ol,
figure,
blockquote {
  margin: 0;
  padding: 0;
}

img,
picture,
video,
canvas,
svg {
  display: block;
  max-width: 100%;
}

ul,
ol {
  list-style: none;
}

button,
input,
textarea,
select {
  font: inherit;
  margin: 0;
  appearance: none;
  border: 1px solid #ccc;
  border-radius: 4px;
  background-color: white;
}

/* CSS Reset end */

main * {
  font-family: 'Roboto';
  letter-spacing: .25px;
}

main {
  /* Reset important bits from page CSS */
  font-family: Arial, Helvetica, sans-serif;
  font-size: 16px;
  font-weight: normal;
  line-height: 1.5;
  text-size-adjust: 0;
  box-shadow: 0px 2px 6px 2px #00000026;


  height: calc(100dvh - 30px);
  border-radius: 30px;
  display: flex;
  justify-content: center;
  flex-direction: column;
  margin: 70px 0 0 0;
  padding-bottom: 10px;

  header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    background-repeat: no-repeat;
    background-size: 20px;
    background-position: 15px 37px;
    padding: 15px 20px;
    font-style: normal;
    font-weight: 600;
    font-size: 14px;
    line-height: 20px;

    h1 {
      font-size: 18px;
      flex-grow: 1;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .mute-button {
      min-height: 25px;
      height: 35px;
      min-width: 35px;
      border-radius: 50%;
      border: 1px solid #C4C7C5;
      padding: 0;
      margin: -1px 30px;
      cursor: pointer;
      background-image: url("./assets/img/icon-volume.svg");
      background-repeat: no-repeat;
      background-position: 50%;
      background-size: 14px;
      background-color: #fff;

      &:hover {
        background-color: #f0f0f0;
      }
    }

    .mute-button.muted {
      background-image: url("./assets/img/icon-mute.svg");
    }


  }

  ul {
    flex-grow: 1;

    /* TODO aiestaran@ MOVE MAIN STYLING FOR UL INTO HERE */
    li {
      font-size: 16px;
    }

  }

  footer {
    display: flex;
    justify-content: space-between;

    .footer-container {
      display: flex;

      width: calc(100% - 20px);
      margin: 0px 10px 0px 10px;

      .input-container {
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        border: 1px solid #C4C7C5;
        border-radius: 20px;
        flex-grow: 1;
      }

      .footer-buttons {
        display: flex;
        margin: 4px 0 4px 10px;
        max-height: 36px;

        button:not(:disabled) {
          cursor: pointer;
        }

        button.send {
          background-image: url("./assets/img/icon-send.svg");
          background-repeat: no-repeat;
          background-position: 50%;
          background-size: 18px;
          color: transparent;
          width: 32px;
          background-color: #DDE3EA;
          border-radius: 30px;
          border: none;
          padding: 0;

          &:disabled {
            opacity: .4;
          }
        }
      }

      .call-circle.icon {
        margin: 0;
        width: 50px;
      }
    }

    .input-container {
      textarea {
        background: transparent;
        border: none;
        padding: 0 12px;
        margin: 5px 0;
        font-size: 14px;
        width: 100%;
        resize: none;
        line-height: 1.5;
        max-height: 129px;
        /* 5 lines (14px * 1.5 * 5) + padding (12px * 2) */
      }

      textarea:focus {
        outline: none;
      }

      .talk-button {
        display: flex;
        align-items: center;
        margin: 0 10px 0 0;
        scale: 0.85;
        background-color: #e9eef7;

        &.chat:not(.talking) {
          background-color: transparent;
        }

        .mic-container {
          margin: 0;
          background-color: #dde3e9;
          border-radius: 30px;
          min-width: 41px;

          &.chat:not(.talking) {
            background-color: transparent;
          }

          img {
            width: 40px;
            scale: .70;
          }
        }

        .call-circle.icon {
          width: 35px;

          .call-circle-inner {
            border: none;
          }

          &:hover {
            background-image: none;
            cursor: default;

            .wave {
              display: block;
            }
          }
        }

      }

      .upload-overlay {
        position: absolute;
        bottom: 50px;
        left: 0;
        background-color: white;
        border: 1px solid #ccc;
        padding: 0px;
        box-shadow: 0 2px 5px rgba(0, 0, 0, 0.2);
        z-index: 10;
        display: flex;
        min-width: 160px;
        flex-direction: column;

        .upload-option {
          display: flex;
          align-items: center;
          min-height: 48px;
          padding: 0 10px;
          gap: 8px;
          cursor: pointer;

          &:hover {
            background-color: #f0f0f0;
          }
        }
      }

      .plus-container {
        color: transparent;
        font-size: 6px;
        margin: 12px 0;
        border-radius: 30px;
        display: flex;
        align-items: center;
        margin-left: 15px;
        width: 20px;
        cursor: pointer;
        background-image: url("./assets/img/icon-plus.svg");
        background-repeat: no-repeat;
        background-position: 50% 50%;
      }

      .input-wrapper {
        flex-grow: 1;
        text-align: left;
        display: flex;
        align-items: center;
        height: 100%;

        .upload-images {
          display: flex;
          gap: 5px;
          padding: 5px;

          .image-preview-container {
            position: relative;

            img {
              width: 60px;
              height: 60px;
              border-radius: 8px;
              object-fit: cover;
            }
          }

          .remove-image-button {
            position: absolute;
            top: -5px;
            right: -5px;
            background-color: rgba(248, 241, 241, 0.7);
            border: none;
            border-radius: 50%;
            cursor: pointer;
            padding: 2px;
            display: none;
            width: 20px;
            height: 20px;
          }

          .image-preview-container:hover .remove-image-button {
            display: flex;
            align-items: center;
            justify-content: center;
          }

          .remove-image-button img {
            width: 10px;
            height: 10px;
            filter: invert(1);
          }
        }
      }
    }
  }

  &.dark {
    --circle-border-target-color: #323333;

    .call-circle {
      border: 1px solid #323333;

      .call-circle-inner {
        border: 1px solid #c3c7c5;

        .wave {
          background: #c3c7c5;
        }
      }

      &.icon {
        border: none;
      }

      &.icon:hover,
      &.icon.muted {
        filter: invert(100%);
        background-color: #ccc;
      }
    }

    footer {
      .input-container {
        .talk-button {
          background-color: #282a2c;

          .mic-container {
            background-color: #333537;
          }
        }

      }
    }
  }
}

:is(main header .call-circle.icon, main footer .call-circle.icon) {
  min-height: 25px;
  height: 35px;
  width: 35px;
  border-radius: 50%;
  border: none;
  padding: 0;
  margin: 0 30px;
  cursor: pointer;
  box-sizing: border-box;


  .call-circle-inner {
    border: 1px solid #C4C7C5;
    padding: 10px;
    margin: 0;
    height: 100%;
    width: 100%;
    min-width: 35px;

    .wave {
      height: 2px;
      border-radius: 4px;
    }

    .wave:nth-child(1) {
      animation-delay: 0.0s;
    }

    .wave:nth-child(2) {
      animation-delay: 0.1s;
    }

    .wave:nth-child(3) {
      animation-delay: 0.3s;
    }
  }

  &.moving {
    animation: none;

    .wave {
      animation: wave-animation-icon 1.2s ease-in-out infinite;
    }
  }

}


main.dark {
  background: #0E0E0E;
  border-radius: 30px;
  border: 1px solid #444746;
  box-shadow: 0px 2px 6px 2px #00000026;

  header {
    border-bottom: 1px solid #444746;
  }

  h1 {
    color: #E3E3E3;
  }

  header .mute-button {
    filter: invert(1);
  }

  ul {
    scrollbar-color: #E3E3E3 #000;

    li {
      color: #E3E3E3;
    }

    li.from-user {
      background: #1E1F20;
    }


  }

  textarea {
    background: none;
    border: 1px solid #444746;
    color: #E3E3E3;
  }

  textarea::placeholder {
    color: #8E918F;
  }

  .talk-button {
    background: none;

    img {
      filter: invert(100%);
    }
  }

  footer {
    .footer-container {
      .footer-buttons {
        button.send {
          filter: invert(100%);

          &:disabled {
            background-color: #fff;
          }
        }
      }
    }
  }

  .plus-container,
  .upload-overlay {
    filter: invert(1);
  }

}

main.light {
  background: #fff;
  border-radius: 30px;
  scrollbar-color: #999 #fff;

  header {
    border-bottom: 1px solid #C4C7C5;
  }

  h1 {
    color: #1F1F1F;
  }

  ul {
    li {
      color: #1F1F1F;
    }

    li.from-user {
      background: #F0F4F9;

      span {
        color: #1F1F1F;
      }
    }
  }

  textarea {
    background: #fff;
    border: 1px solid #C4C7C5;
    color: #1F1F1F;
  }

  textarea::placeholder {
    color: #C4C7C5;
  }

  .close-button {
    img {
      filter: invert(100%);
    }
  }
}

main.call {
  li.from-bot {
    margin: 0;
    padding-left: 0;
  }

  li.from-user,
  li.from-bot:not(.is-displayed-in-call) {
    display: none;
  }

  &.small {
    span {
      display: -webkit-box;
      -webkit-box-orient: vertical;
      overflow: hidden;
      text-overflow: ellipsis;
      font-size: 14px;
    }
  }

  li.from-bot.last-rich-content {
    position: fixed;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    left: 5%;
    top: 5%;
    height: 90vh;
    min-width: 60%;
    background: rgba(0, 0, 0, .9);
    padding: 0 30px 30px 0;
    border: 1px solid #666;
  }

  ul {
    width: 100%;
    height: 100%;
    padding: 0;
    margin: 0;
    overflow: hidden;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    scrollbar-width: thin;

    li {
      font-family: Roboto;
      font-weight: 400;
      font-style: Regular;
      font-size: 16px;
      padding-left: 40px;

      &.is-displayed-in-call {
        overflow: auto;
      }
    }
  }

  .talk-button {
    display: none;
  }

  .call-circle {
    padding: 10px;
  }

  footer {
    .input-container {
      justify-content: center;
      border: none;

      .talk-button {
        border: 1px solid #747775;
        background-color: transparent;

        .mic-container {
          border: 1px solid #747775;
          background-color: transparent;
        }
      }
    }
  }
}

.call-circle {
  min-height: 200px;
  height: 200px;
  width: 200px;
  border-radius: 50%;
  border: 1px solid #eee;
  margin: 50px 0;
  box-sizing: border-box;

  .call-circle-inner {
    border-radius: 50%;
    height: 100%;
    width: 100%;
    border: 1px solid #444746;
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 40px;

    .wave {
      width: 2px;
      height: 3px;
      background: #1f1f1f;
    }
  }

  &.moving {
    animation: pulsate-outer-circle-animation 1.2s ease-in-out infinite;

    .call-circle-inner {
      animation: pulsate-animation 1.2s ease-in-out infinite;
    }

    .wave {
      animation: wave-animation 1.2s ease-in-out infinite;
    }

    .wave:nth-child(1) {
      animation-delay: 0.0s;
    }

    .wave:nth-child(2) {
      animation-delay: 0.1s;
    }

    .wave:nth-child(3) {
      animation-delay: 0.3s;
    }

    .wave:nth-child(4) {
      animation-delay: 0.12s;
    }

    .wave:nth-child(5) {
      animation-delay: 0.4s;
    }

    .wave:nth-child(6) {
      animation-delay: 0.8s;
    }

    .wave:nth-child(7) {
      animation-delay: 0.15s;
    }

    .wave:nth-child(8) {
      animation-delay: 0.26s;
    }

    .wave:nth-child(9) {
      animation-delay: 0.34s;
    }

    .wave:nth-child(10) {
      animation-delay: 0.65s;
    }

    .wave:nth-child(11) {
      animation-delay: 1.0s;
    }
  }
}

ul {
  display: flex;
  flex-direction: column;
  overflow: auto;
  margin-top: 0;
  list-style: none;
  scroll-behavior: smooth;
  padding-inline-start: 0;
  overflow-x: hidden;

  li {
    margin-bottom: 1em;
    font-size: .9em;
  }

  li.from-user {
    text-align: right;
    border-radius: 16px 4px 16px 16px;
    margin-left: auto;
    margin-right: 10px;
    margin-top: 10px;
    padding: 10px;
    max-width: 365px;
  }

  li.from-bot {
    text-align: left;
    border-radius: 4px 16px 16px 16px;
    margin-right: auto;
    margin-left: 10px;
    margin-top: 10px;
    padding: 10px;
    max-width: 390px;
  }
}


.assistant-collapsed {
  position: fixed;
  display: flex;
  bottom: 20px;
  right: 20px;
  height: 65px;
  width: 65px;
  border: 2px solid #000;
  border-radius: 100px;
  background: #fff;
  cursor: pointer;

  img {
    margin: 12px;
  }
}

.assistant-collapsed:hover {
  border: 2px solid #ffF;
}

.close-button {
  font-weight: 700;
  font-family: 'Lucida Sans', 'Lucida Sans Regular', 'Lucida Grande', 'Lucida Sans Unicode', Geneva, Verdana, sans-serif;
  cursor: pointer;
}

.talk-button {
  img {
    width: 25px;
  }

  user-select: none;
  -webkit-user-drag: none;
  background: rgba(217, 255, 220, 0.13);
  border-radius: 51px;
  z-index: 999;
  cursor: pointer;
}

.talk-button * {
  -webkit-user-drag: none;
}

.talk-button:hover {
  img {
    opacity: .7;
  }
}

.talk-button.talking {
  img {
    opacity: 1;
  }
}

.voice-assistant-container {
  width: 450px;
  margin-left: calc(100% - 450px);
  position: fixed;
  top: -60px;
  right: 40px;
}

.voice-assistant-container.small {
  position: fixed;
  width: 300px;
  bottom: 80px;
  top: auto;

  main {
    height: 500px;

    h1 {
      font-size: 16px;
    }

    li {
      max-width: 245px;
    }

    li.call-circle {
      min-height: 120px;
      height: 120px;
      width: 120px;
      margin: 10px 0;

      .call-circle-inner {
        padding: 10px;
      }
    }
  }

  .reconnect-container {
    bottom: 90px;
    right: -10px;
  }

  .talk-button {
    bottom: 10px;
    right: 15px;
  }
}

@media screen and (max-width: 768px) {

  .voice-assistant-container,
  .voice-assistant-container.small {
    position: fixed;
    top: 0;
    left: 0;
    height: 100dvh;
    right: inherit;
    width: 100%;
    margin: 0;

    .assistant-container {
      main {
        margin: 0;
        height: calc(100dvh - 2px);
        border-radius: 0;

        li.from-bot {
          max-width: none;
        }
      }

      main.call {
        li {
          text-align: center;
          max-width: none;
          margin-left: 0;
        }
      }
    }

    .reconnect-container {
      bottom: 20px;
      width: 240px;
      right: calc((100% - 240px) / 2);
    }
  }
}

.inflight-handoff {
  height: 100dvh;
  width: 100%;
  position: fixed;
  top: 0;
  left: 0;
  display: flex;
  justify-content: center;
  align-items: center;
  background-color: rgba(0, 0, 0, 0.1);
  background-repeat: no-repeat;
  background-size: 100px;
  background-position: 50% 50%;
  z-index: 9999;
}

.reconnect-container {
  display: flex;
  justify-content: center;
  width: 100%;
}

.reconnect-button {
  border-radius: 50px;
  padding: 12px 24px;
  font-size: 14px;
  cursor: pointer;
  font-family: 'Google Sans';
  width: 100%;
}

main.light .reconnect-button {
  background-color: #f0f0f0;
  color: #333;
}

main.light .reconnect-button:hover {
  background-color: #e0e0e0;
}

main.dark .reconnect-button {
  background-color: #333;
  color: #eee;
}

main.dark .reconnect-button:hover {
  background-color: #444;
}

/* TODO PUT THESE INTO THE CORRESPONDING AREAS INSTEAD OF SEPARATED */

@keyframes wave-animation {

  0%,
  100% {
    height: 3px;
  }

  50% {
    height: 30px;
  }
}

@keyframes wave-animation-icon {

  0%,
  100% {
    height: 2px;
  }

  50% {
    height: 12px;
  }
}

@keyframes pulsate-animation {

  0%,
  100% {
    transform: scale(1);
  }

  50% {
    transform: scale(1.05);
  }
}

@keyframes pulsate-outer-circle-animation {

  0%,
  100% {
    transform: scale(1);
    border-width: 1px;
  }

  50% {
    transform: scale(1.15);
    border-width: 10px;
    border-color: var(--circle-border-target-color, #fefefe);
  }
}
</style>
