<!--
 @license
 Copyright 2025 Google LLC
 SPDX-License-Identifier: Apache-2.0
-->

<template>
  <div
    ref="logList"
    class="debug-wrapper"
  >
    <ul>
      <li
        v-for="(logMessage, index) in filteredLogMessages"
        :key="`${logMessage.timestamp}-${index}`"
        @click="showDetails(logMessage)"
      >
        <span class="timestamp">
          {{ getTimestampHHMM(logMessage.timestamp) }}<span class="ssms">:{{ getTimestampSSMS(logMessage.timestamp)
          }}</span>
        </span>
        <span>{{ logMessage.event }}: {{ getDisplayMessage(logMessage) }}</span>
      </li>
    </ul>
  </div>
  <div
    v-if="selectedLogMessage"
    class="debug-details-wrapper"
  >
    <dialog
      id="details-dialog"
      open
    >
      <button
        class="close"
        @click="selectedLogMessage = null"
      >
        x
      </button>
      <codemirror
        v-model="selectedLogMessageString"
        :extensions="[basicSetup, json(), oneDark]"
      />
    </dialog>
  </div>
</template>

<script setup>
import { ref, watch, nextTick, computed } from 'vue';
import { basicSetup } from 'codemirror';
import { json } from '@codemirror/lang-json';
import { oneDark } from '@codemirror/theme-one-dark';

const props = defineProps({
  logMessages: {
    type: Array,
    default: undefined
  }
});

const logList = ref(null);

let selectedLogMessage = ref(null);
const selectedLogMessageString = computed(() => {
  if (!selectedLogMessage.value) return '';
  return JSON.stringify(selectedLogMessage.value, null, 2);
});


const filteredLogMessages = computed(() => {
  const filtered = [];
  if (!props.logMessages) return filtered;

  for (const message of props.logMessages) {
    if (message.message.event === 'audio sent') {
      const lastFilteredMessage = filtered.length > 0 ? filtered[filtered.length - 1] : null;
      if (lastFilteredMessage && lastFilteredMessage.message.event === 'audio sent') {
        // This is a consecutive audio message, so we replace the last one
        // to update its timestamp without adding a new line.
        filtered[filtered.length - 1] = message;
      } else {
        // This is the first 'audio sent' message in a sequence, so add it.
        filtered.push(message);
      }
    } else {
      // This is not an 'audio sent' message, so just add it.
      filtered.push(message);
    }
  }
  return filtered;
});

watch(filteredLogMessages, async () => {
  const el = logList.value;

  // We should scroll to the bottom if either the element isn't rendered yet (initial load)
  // or if the user is already near the bottom. A small threshold accounts for rendering quirks.
  const shouldScroll = !el || el.scrollHeight - el.scrollTop - el.clientHeight < 10;

  if (shouldScroll) {
    // Wait for the DOM to update with the new message.
    await nextTick();
    // After the update, the element will be available and we can scroll to the new bottom.
    logList.value.scrollTop = logList.value.scrollHeight;
  }
}, { deep: true });

function showDetails(logMessage) {
  selectedLogMessage.value = logMessage;
}

function getTimestampHHMM(ts) {
  if (!ts) return '';
  const h = ts.getHours().toString().padStart(2, '0');
  const m = ts.getMinutes().toString().padStart(2, '0');
  return `${h}:${m}`;
}
function getTimestampSSMS(ts) {
  if (!ts) return '';
  const s = ts.getSeconds().toString().padStart(2, '0');
  const ms = ts.getMilliseconds().toString().padStart(3, '0');
  return `${s}.${ms}`;
}

function getDisplayMessage(logMessage) {
  if (logMessage.message?.message) {
    return logMessage.message.message;
  }
  if (logMessage.message?.payload) {
    return '<rich payload>';
  }
  return '<unknown content>';
}

</script>

<style scoped>
.debug-wrapper {
  position: fixed;
  bottom: 40px;
  left: 0;
  padding: 10px 20px;
  margin: 0;
  background: #000;
  border: 2px solid white;
  width: 50%;
  max-width: calc(100% - 500px);
  overflow: hidden;
  overflow-y: auto;

  ul {
    list-style: none;
    height: 300px;
    padding: 0;

    li {
      padding-bottom: 10px;
      cursor: zoom-in;
    }

    .timestamp {
      font-family: monospace;
      color: #888;
      margin-right: 1em;
      font-size: .8em;

      .ssms {
        font-size: .6em;
      }
    }
  }

}

dialog {
  max-width: 90%;
  max-height: 90vh;
  margin: auto;
  border-width: 1px;
  border-radius: 30px 0 30px 30px;
  background: #333;
  color: #fff;
  overflow: hidden;
  overflow-y: auto;
  padding: 0;

  p {
    margin-bottom: 2em;
  }

  button {
    margin: auto;
    display: block;
    background: #333;
    color: #fff;
    z-index: 999;
  }

  button.close {
    margin: 0;
    padding: 0 4px 2px 4px;
    border: none;
    position: absolute;
    top: 15px;
    right: 10px;
    font-size: 14px;
  }

  code {
    text-wrap: wrap;
    overflow-wrap: break-word;
  }
}
</style>
