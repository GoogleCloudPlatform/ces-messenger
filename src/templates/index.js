/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

// Precompiled using handlebars src/templates/ -e hbs -f src/templates/precompiled.js
// Then added these 2 lines to the top of the file:
// import Handlebars from 'handlebars/runtime';
// if (Handlebars) window.Handlebars = Handlebars;
import './precompiled.js';


/**
 * Renders a pre-compiled Handlebars template.
 * @param {string} templateName The name of the template to render.
 * @param {object} context The data to pass to the template.
 * @returns {string} The rendered HTML string.
 */
export function renderTemplate(templateName, context) {
  const template = Handlebars.templates[templateName];
  if (template) {
    return template(context);
  }
  console.log(`Template '${templateName}' not found.`);
  return undefined;
}

/**
 * Adds a compiled Handlebars template to the templates map.
 * @param {string} templateName The name of the template.
 * @param {Function} compiledTemplate The compiled Handlebars template.
 */
export function registerTemplate(templateName, compiledTemplate) {
  if (!Handlebars.templates) {
    Handlebars.templates = {};
  }
  Handlebars.templates[templateName] = compiledTemplate;
}