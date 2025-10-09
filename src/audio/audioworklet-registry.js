/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * A registry to map attached worklets by their audio-context
 * any module using `audioContext.audioWorklet.addModule(` should register the worklet here
 */
export const registeredWorklets = new Map();

export function createWorkletFromSrc(name, workletSrc) {
  const blob = new Blob(
    [`${workletSrc}`],
    { type: 'application/javascript' }
  );
  return URL.createObjectURL(blob);
}