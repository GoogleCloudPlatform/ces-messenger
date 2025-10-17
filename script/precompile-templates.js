/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { exec } from 'child_process';
import fs from 'fs';
import path from 'path';

const handlebarsCli = path.join('node_modules', '.bin', 'handlebars');
const templatesDir = path.join('src', 'templates');
const outputFile = path.join(templatesDir, 'precompiled.js');
const prependContent = `import Handlebars from 'handlebars/runtime';
if (Handlebars) window.Handlebars = Handlebars;`;

const command = `${handlebarsCli} ${templatesDir} -e hbs -f ${outputFile}`;

console.log('Precompiling Handlebars templates...');

exec(command, (error, stdout, stderr) => {
  if (error) {
    console.error(`Error executing handlebars: ${error.message}`);
    return;
  }
  if (stderr) {
    console.error(`Handlebars stderr: ${stderr}`);
  }

  console.log('Handlebars precompilation successful.');

  const originalContent = fs.readFileSync(outputFile, 'utf8');
  const newContent = `${prependContent}\n${originalContent}`;
  fs.writeFileSync(outputFile, newContent, 'utf8');
  console.log(`Successfully prepended imports to ${outputFile}`);
});