/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { ref } from 'vue';

class Logger {
  constructor() {
    this.logs = ref([]);
    this.enableDebugger = false;
    window.cesMessengerLogs = this.logs.value;
  }
  _add(log) {
    /* 
        type: the type of log item, can be info | warn | error
        message: the message to be logged
        event: the event that triggered the log, can be user-message | bot-message | system
        payload: the payload of the event, can be the message object or any other relevant data
        */
    if (this.enableDebugger) {
      const eventToLog = log.message?.event;
      if (eventToLog === 'audio sent' || eventToLog === 'audio received') {
        const lastLog =
          this.logs.value.length > 0
            ? this.logs.value[this.logs.value.length - 1]
            : null;

        if (lastLog && lastLog.message?.event === eventToLog) {
          // Found a previous log of the same audio event type.
          // Append to it instead of creating a new one.
          lastLog.count = (lastLog.count || 1) + 1;
          lastLog.timestamp = new Date();
          // The payload for audio events is an array of the individual chunks
          if (!Array.isArray(lastLog.message.payload)) {
            lastLog.message.payload = [lastLog.message.payload];
          }
          lastLog.message.payload.push(log.message.payload);
          return; // Done, no new log entry needed.
        }
      }

      log.timestamp = new Date();
      this.logs.value.push(log);
      Logger.log(log);
    }
  }
  info(message, event = 'system', payload = {}) {
    this._add({ message, type: 'info', event, payload });
  }
  warn(message, event = 'system', payload = {}) {
    this._add({ message, type: 'warn', event, payload });
  }
  error(message, event = 'system', payload = {}) {
    this._add({ message, type: 'error', event, payload });
  }

  /* eslint-disable */
  // Static methods to replace console logs
  static log(...args) {
    console.log(...args);
  }

  static warn(...args) {
    console.warn(...args);
  }

  static error(...args) {
    console.error(...args);
  }
  static debug(...args) {
    console.debug(...args);
  }
  /* eslint-enable */
}

export { Logger };
