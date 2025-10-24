/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { defineCustomElement } from 'vue';
import BidiWidget from '@/BidiWidget.ce.vue';
import { version } from './agent-config.js';
import { Logger } from '@/logger.js';

Logger.log('Starting the web component, version:', version);

const element = defineCustomElement(BidiWidget);
customElements.define('ces-messenger', element);

if (typeof window.kite === 'undefined') {
  window.kite = {};
}
