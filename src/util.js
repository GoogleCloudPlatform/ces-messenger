/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { cesUrlPattern } from '@/agent-config.js';

function getAgentDetails(url) {
  const match = url.trim().match(cesUrlPattern);
  if (match) {
    return {
      projectId: match.groups.project_id,
      location: match.groups.location,
      agentId: match.groups.agent_id,
      agentType: match.groups.agent_type,
    };
  } else if (url.trim().match('^wss?://')) {
    return {
      projectId: null,
      location: null,
      agentId: null,
      agentType: 'adk',
    };
  }
}

function generateSessionId() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
    const r = (Math.random() * 16) | 0,
      v = c == 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Convert a base64 string to an ArrayBuffer
 * @param {string} base64 The base64 string to convert
 * @returns {ArrayBuffer} The converted ArrayBuffer
 */
function base64ToArrayBuffer(base64) {
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes.buffer;
}

async function audioContext({ sampleRate }) {
  const context = new (window.AudioContext || window.webkitAudioContext)({
    sampleRate,
  });
  await context.resume();
  return context;
}

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
const VAD_THRESHOLD = 0.01;


export {
  getAgentDetails,
  generateSessionId,
  base64ToArrayBuffer,
  audioContext,
  isVoiceActive,
};
