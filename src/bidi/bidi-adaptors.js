/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { getAgentDetails, generateSessionId } from '@/util.js';
import { Logger } from '@/logger.js';
import configMessageTemplates from '@/bidi/config-templates.json';

export class AdaptorFactory {
  static createAdaptor(agentConfig) {

    const { projectId, agentId, agentType, location } = getAgentDetails(agentConfig.cesUrl);

    if (agentType === 'agents') {
      return new BidiStreamingDetectIntentAdaptor(projectId, agentId, location);
    } else if (agentType === 'apps') {
      if (agentConfig.audioInputMode === 'NONE') {
        const adaptor = new RunSessionAdaptor(projectId, agentId, location);
        adaptor.agentConfig = agentConfig;
        return adaptor;
      } else {
        return new BidiRunSessionAdaptor(projectId, agentId, location);
      }
    } else if (agentType === 'adk') {
      const adaptor = new BidiRunSessionAdaptor(null, null, null);
      adaptor.appId = 'BIDI_ADK';
      return adaptor;
    }
  }
}

class AgentProtocolAdaptor {
  constructor(projectId, agentId, location) {
    this.apiId = 'UNDEFINED';
    this.projectId = projectId;
    this.agentId = agentId;
    this.location = location;
    this.sessionId = generateSessionId();

    // Used for identifying user barge-in
    this.lastTranscript = null;
    this.recentTranscripts = 0;
  
    // Barge-in will be triggered when we receive this amount of transcripts separated
    // no more than the max time gap
    this.bargeInTranscriptsTrigger = 3;
    // If no transcript is received in the indicated gap, reset the transcript count.
    this.bargeInMaxGapMs = 300;
  }

  newSession() {
    this.sessionId = generateSessionId();
  }

  // Ends the current session, and returns the session closure message, if such message
  // exists for the underlying protocol.
  endSession() {
    this.sessionId = generateSessionId();
    return null;
  }

  // Client-side barge-in detection: if we receive multiple transcripts in a short 
  // period of time, it's likely a user barge-in
  detectBargeIn(transcript, isFinal=false) {
    if (this.bargeInTranscriptsTrigger == -1) {
      return false;
    }

    // If the transcript is considered to be a final question, raise it as barge-in
    // to stop the current audio response.
    if (isFinal) return true;

    const now = Date.now();
    const timeSinceLast = this.lastTranscript ? now - this.lastTranscript : Infinity;
    this.lastTranscript = now;
    if (timeSinceLast < this.bargeInMaxGapMs) {
      this.recentTranscripts++;
    } else {
      this.recentTranscripts = 0;
    }
    Logger.log('barge-in detected:', (this.recentTranscripts >= this.bargeInTranscriptsTrigger));
    return this.recentTranscripts >= this.bargeInTranscriptsTrigger;
  }

  // If a valid JSON custom configuration was provided, this configuration will
  // be merged with the computed configuration. If a value exists in both 
  // configurations, the custom configuration will take precedence.
  mergeConfig(customConfig, computedConfig) {
    if (!customConfig) return computedConfig;

    // if custom config is a string, try to parse it as JSON
    let customConfigMap = customConfig;
    if (typeof customConfig === 'string') {
      try {
        customConfigMap = JSON.parse(customConfig);
      } catch (error) {
        Logger.log(error);
        return computedConfig;
      }
    }

    if (typeof customConfig !== 'object') return computedConfig;

    for (const k of Object.keys(customConfigMap)) {
      const v = customConfigMap[k];
      const cv = computedConfig[k];
      if (!Object.hasOwn(computedConfig, k)) {
        computedConfig[k] = v;
      } else {
        // If the types don't match, we keep the one provided in the custom config
        if (typeof(computedConfig[k]) != typeof(v)) {
          computedConfig[k] = v;
        } else if (Array.isArray(v)) {
          cv.push(...v);
        } else if (typeof v === 'object' && v !== null) {
          this.mergeConfig(v, cv);
        } else {
          computedConfig[k] = v;
        }
      }
    }
    return computedConfig;
  }
}

export class BidiStreamingDetectIntentAdaptor extends AgentProtocolAdaptor {
  constructor(projectId, agentId, location) {
    super(projectId, agentId, location);
    this.apiId = 'BIDI_SDI';
    this.appString = `projects/${this.projectId}/locations/${this.location}/agents/${this.agentId}`;
  }

  getConfigMessage(agentConfig, accessToken) {
    let envelope = JSON.parse(JSON.stringify(configMessageTemplates[this.apiId]));
    envelope.configMessage.session = `${this.appString}/sessions/${this.sessionId}`;
    envelope.configMessage.inputAudioConfig.languageCode = agentConfig.languageCode;
    envelope.configMessage.languageCode = agentConfig.languageCode;
    envelope.configMessage.outputAudioConfig.synthesizeSpeechConfig.voice.name = agentConfig.voice;
    envelope.configMessage.streamingMode = agentConfig.streamingMode;
    envelope.configMessage.enableStreamingSynthesize = agentConfig.streamingTts;
    if (agentConfig.currentPlaybook) {
      envelope.configMessage.query_params = envelope.configMessage.query_params || {};
      envelope.configMessage.query_params.current_playbook = agentConfig.currentPlaybook;
    }

    if (accessToken) {
      envelope.configMessage.accessToken = accessToken;
    }
    return this.mergeConfig(agentConfig.customConfigJson, envelope);
  }

  marshallMessage(message) {
    if (message.type.toUpperCase() === 'SESSION_INPUT') {
      return { inputData: { text: message.payload }};
    } else if (message.type.toUpperCase() === 'AUDIO') {
      return { inputData: message.payload };
    }
  }

  unmarshallMessage(message) {
    let receivedMessages = [];

    if (message.audioOutput && message.audioOutput.audio) {
      var unifiedMessage = {};
      unifiedMessage.type = 'AUDIO';
      unifiedMessage.audio = message.audioOutput.audio;
      if (message.audioOutput.outputAudioConfig) {
        unifiedMessage.sampleRateHertz = message.audioOutput.outputAudioConfig.sampleRateHertz;
        unifiedMessage.audioEncoding = message.audioOutput.outputAudioConfig.audioEncoding;
      }

      receivedMessages.push(unifiedMessage);
    }

    if (message.detectIntentResponse && message.detectIntentResponse.queryResult) {
      const responseMessages = message.detectIntentResponse.queryResult.responseMessages;
      if (responseMessages) {
        const botResponses = responseMessages.map(m => m.text?.text).flat();
        botResponses.forEach(botResponse => {
          if (botResponse) {
            var unifiedMessage = {};
            unifiedMessage.type = 'TEXT';
            unifiedMessage.text = botResponse;
            unifiedMessage.responseType = message.detectIntentResponse.responseType;
            receivedMessages.push(unifiedMessage);
          }
        });
      }
        
      const toolCallMessage = responseMessages?.find(m => m.toolCall);
      if (toolCallMessage) {
        let unifiedMessage = {};
        unifiedMessage.type = 'TOOL_CALL';
        unifiedMessage.toolCall = toolCallMessage;
        receivedMessages.push(unifiedMessage);
      }

      const finalResponse = message.detectIntentResponse.responseType === 'FINAL';
      if (finalResponse) {
        let unifiedMessage = {};
        unifiedMessage.type = 'CONTROL_SIGNAL';
        unifiedMessage.turnCompleted = true;
        receivedMessages.push(unifiedMessage);
      }

      // catch sessions closed by the agent
      if (responseMessages?.find(m => m.endInteraction) || 
            ['END_SESSION', 'flow.cancelled'].includes(message.detectIntentResponse.queryResult.match?.event)) {
        let unifiedMessage = {};
        unifiedMessage.type = 'CONTROL_SIGNAL';      
        unifiedMessage.agentDisconnect = true;
        if (message.detectIntentResponse.queryResult.match?.event === 'flow.failed.human-escalation') {
          unifiedMessage.disconnectReason = 'HARD_HANDOVER';
        } else {
          unifiedMessage.disconnectReason = 'AGENT_REQUESTED';
        }
        receivedMessages.push(unifiedMessage);
      }
    }

    if (message.recognitionResult) {
      let unifiedMessage = {};
      unifiedMessage.type = 'TRANSCRIPT';
      unifiedMessage.transcript = message.recognitionResult.transcript;
      if (message.recognitionResult.isFinal) unifiedMessage.isFinal = true;
      if (this.detectBargeIn(message.recognitionResult.transcript, unifiedMessage.isFinal)) {
        unifiedMessage.interruptionSignal = true;
      }
      receivedMessages.push(unifiedMessage);
    }

    return receivedMessages;
  }
}

export class BidiRunSessionAdaptor extends AgentProtocolAdaptor {
  constructor(projectId, agentId, location) {
    super(projectId, agentId, location);
    this.apiId = 'BIDI_RS';
    this.appString = `projects/${this.projectId}/locations/${this.location}/apps/${this.agentId}`;
  }

  endSession() {
    super.endSession();
    // TODO: add session close message once it's available on the protocol
    // return { endSession: true };
    return null;
  }

  getConfigMessage(agentConfig, accessToken) {
    let envelope = JSON.parse(JSON.stringify(configMessageTemplates[this.apiId]));
    envelope.config.session = `${this.appString}/sessions/${this.sessionId}`;

    if (agentConfig.deploymentId) {
      envelope.config.deployment = agentConfig.deploymentId;
    }

    if (accessToken) {
      envelope.config.accessToken = accessToken;
    }

    if (agentConfig.environment && agentConfig.environment === 'dev' && agentConfig.apiUri) {
      envelope.config.environment = 'dev';
    }

    return this.mergeConfig(agentConfig.customConfigJson, envelope);
  }

  marshallMessage(message) {
    if (message.type.toUpperCase() === 'SESSION_INPUT') {
      const marshaledMessages = [];
      if (message.payload.vars && Object.keys(message.payload.vars).length > 0) {
        marshaledMessages.push({ realtimeInput: { variables: message.payload.vars }});
      }
      if (message.payload.images && message.payload.images.length > 0) {
        for (const image of message.payload.images) {
          const imageInput = {};
          if (image.startsWith('data:image/')) {
            imageInput.data = image.split(',')[1];
            imageInput.mime_type = image.split(';')[0].split(':')[1];
          }
          marshaledMessages.push({ realtimeInput: { image: imageInput }});
        }
      }
      if (message.payload.text && message.payload.text.length > 0) {
        marshaledMessages.push({ realtimeInput: { text: message.payload.text }});
      }
      return marshaledMessages;
    } else if (message.type.toUpperCase() === 'AUDIO') {
      return { realtimeInput: message.payload };
    } else if (message.type.toUpperCase() === 'VARS') {
      return { realtimeInput: { variables: message.payload } };
    } else if (message.type.toUpperCase() === 'TOOL_RESPONSE') {
      const marshalledMessage = { realtimeInput: { toolResponses: { toolResponses: [message.payload] }}};
      return marshalledMessage;
    }
  }

  unmarshallMessage(message) {
    let receivedMessages = [];

    if (message.sessionOutput) {
      const baseMessage = {};
      if (message.sessionOutput.turnIndex) {
        baseMessage.turnIndex = message.sessionOutput.turnIndex;
      }
      if (message.sessionOutput.turnCompleted) {
        baseMessage.turnCompleted = message.sessionOutput.turnCompleted;
      }
      if (message.sessionOutput.partial != undefined) {
        baseMessage.partial = message.sessionOutput.partial;
      }

      if (message.sessionOutput.text) {
        let unifiedMessage = {...baseMessage};
        unifiedMessage.type = 'TEXT';
        unifiedMessage.text = message.sessionOutput.text;
        receivedMessages.push(unifiedMessage);
      } else if (message.sessionOutput.audio) {
        let unifiedMessage = {...baseMessage};
        unifiedMessage.type = 'AUDIO';
        unifiedMessage.audio = message.sessionOutput.audio;
        receivedMessages.push(unifiedMessage);
      } else if (message.sessionOutput.toolCalls) {
        for (const toolCall of message.sessionOutput.toolCalls.toolCalls) {
          let unifiedMessage = {...baseMessage};
          unifiedMessage.type = 'TOOL_CALL';
          unifiedMessage.toolCall = toolCall;
          receivedMessages.push(unifiedMessage);
        }
      }
    }

    if (message.recognitionResult) {
      let unifiedMessage = {};
      unifiedMessage.type = 'TRANSCRIPT';
      unifiedMessage.transcript = message.recognitionResult.transcript;
      if (message.recognitionResult.partial != undefined) {
        unifiedMessage.partial = message.recognitionResult.partial;
      }
      receivedMessages.push(unifiedMessage);
    }

    if (message.interruptionSignal) {
      let unifiedMessage = {};
      unifiedMessage.type = 'CONTROL_SIGNAL';
      unifiedMessage.interruptionSignal = true;
      receivedMessages.push(unifiedMessage);
    }

    if (message.turnCompleted ||
       (message.sessionOutput && message.sessionOutput.turnCompleted)) {
      let unifiedMessage = {};
      unifiedMessage.type = 'CONTROL_SIGNAL';
      unifiedMessage.turnCompleted = true;
      receivedMessages.push(unifiedMessage);
    }

    // catch sessions closed by the agent
    if (message.endSession) {
      let unifiedMessage = {};
      unifiedMessage.type = 'CONTROL_SIGNAL';      
      unifiedMessage.agentDisconnect = true;
      receivedMessages.push(unifiedMessage);
    }

    // Half-close initiated by the server
    if (message.goAway) {
      let unifiedMessage = {};
      unifiedMessage.type = 'CONTROL_SIGNAL';      
      unifiedMessage.goAway = true;
      receivedMessages.push(unifiedMessage);
    }

    return receivedMessages;
  }
}

export class RunSessionAdaptor extends AgentProtocolAdaptor {
  constructor(projectId, agentId, location) {
    super(projectId, agentId, location);
    this.apiId = 'RS';
    this.appString = `projects/${this.projectId}/locations/${this.location}/apps/${this.agentId}`;
    this.agentConfig = null;
  }

  endSession() {
    super.endSession();
    // TODO: add session close message once it's available on the protocol
    // return { endSession: true };
    return null;
  }

  // eslint-disable-next-line no-unused-vars
  getConfigMessage(agentConfig, accessToken) {

    let envelope = { config: {} };
    envelope.config.session = `${this.appString}/sessions/${this.sessionId}`;
    if (agentConfig.deploymentId) {
      envelope.config.deployment = agentConfig.deploymentId;
    }

    return envelope;
  }

  marshallMessage(message) {
    const marshalledMessage = { inputs: [ ] };
    const config = this.getConfigMessage(this.agentConfig, null);
    marshalledMessage.config = config.config;

    if (message.type.toUpperCase() === 'SESSION_INPUT') {
      if (message.payload.vars && Object.keys(message.payload.vars).length > 0) {
        marshalledMessage.inputs.push({ variables: message.payload.vars });
      }
      if (message.payload.images && message.payload.images.length > 0) {
        for (const image of message.payload.images) {
          const imageInput = {};
          if (image.startsWith('data:image/')) {
            imageInput.data = image.split(',')[1];
            imageInput.mime_type = image.split(';')[0].split(':')[1];
          }
          marshalledMessage.inputs.push({ image: imageInput });
        }
      }
      if (message.payload.text && message.payload.text.length > 0) {
        marshalledMessage.inputs.push({ text: message.payload.text });
      }
    }
    if (message.type.toUpperCase() === 'TOOL_RESPONSE') {
      marshalledMessage.inputs.push({ toolResponses: { toolResponses: [message.payload] }});
    }
    return marshalledMessage;
  }

  unmarshallMessage(message) {
    const receivedMessages = [];

    if (message.outputs) {

      const outputItems = Array.isArray(message.outputs) ? message.outputs : [message.outputs];  

      for (const outputItem of outputItems) {
        if (outputItem.text) {
          let unifiedMessage = {};
          unifiedMessage.type = 'TEXT';
          unifiedMessage.text = outputItem.text;
          if (outputItem.turnIndex) {
            unifiedMessage.turnIndex = outputItem.turnIndex;
          }
          if (outputItem.turnCompleted) {
            unifiedMessage.turnCompleted = outputItem.turnCompleted;
          }
          receivedMessages.push(unifiedMessage);
          if (message.outputs.partial != undefined) {
            unifiedMessage.partial = message.outputs.partial;
          }
        }

        if (outputItem.toolCalls) {
          for (const toolCall of outputItem.toolCalls.toolCalls) {
            const unifiedMessage = {};
            unifiedMessage.type = 'TOOL_CALL';
            unifiedMessage.toolCall = toolCall;
            receivedMessages.push(unifiedMessage);
          }
        }
      }
    }
    return receivedMessages;
  }
}
