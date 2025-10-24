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

export {
  getAgentDetails,
  generateSessionId,
  base64ToArrayBuffer,
  audioContext,
};
