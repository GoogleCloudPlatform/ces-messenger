/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { ref } from 'vue';
import { AudioStreamerFactory } from '@/audio/audio-streamer.js';
import { AudioRecorder } from '@/audio/audio-recorder.js';
import { BidiStreamingDetectIntentAdaptor } from '@/bidi/bidi-adaptors.js';

// Empty audio to send in push-to-talk mode when the mic is off
const zeroFilledBuffer = new ArrayBuffer(4096);
const uint8Array = new Uint8Array(zeroFilledBuffer);
const emptyAudio = btoa(String.fromCharCode(...uint8Array));
const VAD_TIMEOUT = 200;
const VAD_THRESHOLD = 0.01;

/**
 * Manages image uploads for the Bidi Widget.
 */
export class AudioHelper {
  /**
   * @param {object} agentConfig The agent configuration.
   */
  constructor(agentConfig, bidiAdaptor, onCompleteCallback) {

    this.agentConfig = agentConfig;
    this.bidiAdaptor = bidiAdaptor;
    this.audioRecorder = null;
    this.audioContext = null;
    this.audioStreamer = null;
    this.pushToTalk = !['DEFAULT_ON', 'NONE', undefined].includes(agentConfig.audioInputMode);

    // Speech detection
    this.voiceDetected = ref(false);
    this.lastVoiceDetected = new Date(0);

    this.displayMuteButton = ref(agentConfig.audioInputMode !== 'NONE' && agentConfig.audioOutputMode !== 'DISABLED' && agentConfig.audioOutputMode !== 'ALWAYS_ON');
    this.audioContextState = ref(null);
    this.isAudioPlaying = ref(false);
    this.audioEnabled = ref(agentConfig.audioInputMode !== 'NONE' && agentConfig.audioOutputMode !== 'DISABLED' && agentConfig.audioOutputMode !== 'DEFAULT_OFF');
    this.talking = ref(!this.pushToTalk);

    if (agentConfig.audioInputMode !== 'NONE') {
      let sampleRate = 16e3;
      const configMessage = this.bidiAdaptor.getConfigMessage(agentConfig, null);
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

      this.audioRecorder = new AudioRecorder();
      this.audioContext = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: sampleRate });

      if (agentConfig.audioOutputMode === 'NONE') {
        this.audioStreamer = AudioStreamerFactory.createStreamer(this.audioContext, 'SILENT');
      } else {
        this.audioStreamer = AudioStreamerFactory.createStreamer(this.audioContext);
        this.audioStreamer.onComplete = onCompleteCallback;
      }

      // Playbooks Live specific settings
      if (bidiAdaptor instanceof BidiStreamingDetectIntentAdaptor) {
        // Add fade-in at the begining of the audio to avoid the click sound
        this.audioStreamer.fadeIn = true;
        // Adjust barge-in sensitivity
        if (!agentConfig.bargeInSensitivity) agentConfig.bargeInSensitivity = 'MEDIUM';

        if (agentConfig.bargeInSensitivity == 'LOW') {
          this.bidiAdaptor.bargeInTranscriptsTrigger = 5;
          this.bidiAdaptor.bargeInMaxGapMs = 300;
        } else if (agentConfig.bargeInSensitivity == 'MEDIUM') {
          this.bidiAdaptor.bargeInTranscriptsTrigger = 3;
          this.bidiAdaptor.bargeInMaxGapMs = 500;
        } else if (agentConfig.bargeInSensitivity == 'HIGH') {
          this.bidiAdaptor.bargeInTranscriptsTrigger = 1;
          this.bidiAdaptor.bargeInMaxGapMs = 1000;
        } else if (agentConfig.bargeInSensitivity == 'DISABLED') {
          this.bidiAdaptor.bargeInTranscriptsTrigger = -1;
        }
      }
      this.audioContextState.value = this.audioContext.state;
      this.audioContext.onstatechange = () => {
        this.audioContextState.value = this.audioContext.state;
      };
    }

  }

  setTalkingMode(talkingMode) {
    if (talkingMode && this.audioContext?.state !== 'running') {
      this.audioContext.resume();
    }
    this.talking.value = talkingMode;
  }

  async startRecording(onDataCallback) {
    if (this.agentConfig.audioInputMode !== 'NONE') {
      if (this.audioContext.state === 'suspended') {
        await this.audioContext.resume();
      }
      await this.audioRecorder.start();

      this.audioRecorder.on('data', (base64Data) => {
        // If not talking (in push-to-talk mode, send empty audio instead of actual audio)
        if (!this.talking.value) {
          base64Data = emptyAudio;
          this.voiceDetected.value = false;
        } else {
          const now = Date.now();
          if (this.isVoiceActive(base64Data)) {
            this.lastVoiceDetected = now;
            this.voiceDetected.value = true;
          } else if (this.lastVoiceDetected && now - this.lastVoiceDetected > VAD_TIMEOUT) {
            this.voiceDetected.value = false;
          }
        }
        onDataCallback(base64Data);
      });
    }
  }

  playAudioCLip(audioClip) {
    this.audioStreamer.addChunk(audioClip);
    this.audioStreamer.play();
    this.isAudioPlaying.value = true;
  }


  pauseConversation() {
    if (this.agentConfig.audioInputMode !== 'NONE') {
      this.audioStreamer.stop();
      this.audioRecorder.stop();
    }
  };

  stopAudio() {
    this.audioStreamer.stop();
  }

  /**
   * Analyzes a base64 audio chunk to detect if it contains voice.
   * @param {string} base64Data The base64 encoded audio data.
   * @returns {boolean} `true` if voice is detected, otherwise `false`.
   */
  isVoiceActive(base64Data) {
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
}