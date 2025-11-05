/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { base64ToArrayBuffer } from '@/util.js';
import { Logger } from '@/logger.js';

// To avoid a clicking sound when audio starts playing, we fade-in audio playback
// starting from nearly zero to full volume. This is the fade-in window time duration.
const FADE_IN_END_SECONDS = 0.05;

export class AudioStreamerFactory {
  static createStreamer(audioContext, streamerType='DEFAULT') {

    if (streamerType === 'SILENT') {
      return new SilentStreamer();
    } else {
      return new StreamedAudioPlayer(audioContext);
    }
  }
}

export class SilentStreamer {
  constructor() {
    this.onComplete = () => {};
  }

  // eslint-disable-next-line no-unused-vars
  addChunk(chunk) {
    // Do nothing
  }

  play() {
    // Do nothing
  }

  stop() {
    // Do nothing
  }

  complete() {
    // Do nothing
  }
}

export class AudioStreamer {
  constructor(audioContext) {
    this.context = audioContext;
    this.playbackRate = 1;
    this.chunkCounter = 0;
    // Used for audio fade-in
    this.fadeIn = false;
    // Wave header size
    this.stickyHeaderSize = -1;
    this.headersSearched = 0;
    this.headersLegthSum = 0;

    this.onComplete = () => {};
  }

  // Convert the audio chunk to Float32Array
  processChunk(chunkToProcess) {
    let chunk = null;
    if (chunkToProcess instanceof Uint8Array) {
      chunk = chunkToProcess;
    } else if (typeof chunkToProcess === 'string') {
      const arrayBuffer = base64ToArrayBuffer(chunkToProcess);
      if (!arrayBuffer) {
        Logger.error('ArrayBuffer is null after base64 decoding!');
        return null; // Stop if conversion failed
      }

      chunk = new Uint8Array(arrayBuffer);
    }

    // Remove the WAVE file header, if found
    const headerLength = this.headerLegth(chunk);
    if (headerLength > 0 && chunk.length > headerLength) {
      chunk = chunk.slice(headerLength);
    }

    if (chunk.length === 0) {
      Logger.debug('[addPCM16] Chunk length is 0, skipping.');
      return null;
    }

    this.chunkCounter++;

    // Convert incoming PCM16 data to float32
    const float32Array = new Float32Array(chunk.length / 2);
    const dataView = new DataView(chunk.buffer, chunk.byteOffset, chunk.byteLength);

    let processedSamples = 0;

    for (let i = 0; i < chunk.length / 2; i++) {

      processedSamples++;

      try {
        // Keep as Big-Endian for now, change 'false' to 'true' if static persists
        const int16 = dataView.getInt16(i * 2, true); // Big-Endian
        float32Array[i] = int16 / 32768;

      } catch (e) {
        Logger.error(`[addPCM16] Error reading Int16 at index ${i}:`, e);
        float32Array[i] = 0;
      }
    }

    if (processedSamples === 0 && chunk.length > 0) {
      Logger.error('[addPCM16] Loop finished but processed 0 samples, despite non-empty chunk!');
      return null; // Don't proceed if loop didn't run
    }

    // Check sample rate match (only need to do this once really)
    if (this.chunkCounter === 1) {
      if (this.context.sampleRate !== this.sampleRate) {
        Logger.warn('[addPCM16] SAMPLE RATE MISMATCH DETECTED!');
      }
    }

    // Check if float32Array length is valid before creating buffer
    if (float32Array.length === 0 && chunk.length > 0) {
      Logger.error('[addPCM16] Failed to convert chunk to Float32Array, length is 0.');
      return  null;
    } else if (float32Array.length === 0 && chunk.length === 0) { // Check float32Array
      // Ignore empty chunks silently if conversion resulted in empty array
      return null;
    }

    return float32Array;
  }

  headerLegth(decodedAudio) {
    if (this.stickyHeaderSize > -1) return this.stickyHeaderSize;

    const dataIdentifier = [100, 97, 116, 97]; // 'data' acsii char codes
    let headerLength = 0;
    for (let i = 0; i < decodedAudio.length - 3; i++) {
      if (decodedAudio[i] === dataIdentifier[0] &&
            decodedAudio[i+1] === dataIdentifier[1] &&
            decodedAudio[i+2] === dataIdentifier[2] && 
            decodedAudio[i+3] === dataIdentifier[3]) {
        // If "data" found in the array, the total length of the header will
        // be the position of the 'data' string + its legth + 4 bytes for the
        // audio data length that follows
        // See https://docs.fileformat.com/audio/wav/
        headerLength = i + dataIdentifier.length + 4;
        break;
      }
    }
    // If we find the same header legth 5 times in a row, we'll assume it will always be the same
    if (this.stickyHeaderSize == -1) {
      this.headersSearched += 1;
      this.headersLegthSum += headerLength;
      if (headerLength != this.headersLegthSum/this.headersSearched) {
        this.stickyHeaderSize = -2; // If there is one miss, don't try this again
      } else if (this.headersSearched > 5) { // 5 times in a row. Let's keep this.
        this.stickyHeaderSize = headerLength;
      }
    }

    return headerLength;
  }
}

/**
 * A class to handle the seamless playback of streamed audio chunks.
 * It buffers incoming Float32Array chunks and schedules them for gapless
 * playback using the Web Audio API.
 */
export class StreamedAudioPlayer extends AudioStreamer {
  /**
   * @param {AudioContext} [audioContext] - The audio context.
   */
  constructor(audioContext) {
    super(audioContext);
    this.sampleRate = this.context.sampleRate;
    this.numChannels = 1;
    this.audioQueue = []; // Use a simple array as a queue for audio chunks
    this.isPlaying = false;
    this.nextPlayTime = 0; // Time at which the next buffer should start playing
    this.schedulingInterval = null;
    this.currentSource = null;
    this.gainNode = this.context.createGain();
    this.gainNode.connect(this.context.destination);
    // Used for calculating actual audio clip durations (useful for debugging)
    // This will also help know if there are still audio clips to play when each source
    // is complete. On the last one, we'll call the onComplete callback.
    this.startTimes = [];

    // These are used to determine the average number of chunks per clip played. If this
    // equals 1, it means we are not in streaming mode, and fade in, if enabled,
    // will need to apply on every clip.
    this.chunksPlayed = 0;
    this.clipsPlayed = 0;

    // --- Configuration ---
    // How far ahead to schedule audio (in seconds). This provides a buffer against
    // network jitter or processing delays.
    this.scheduleAheadTime = 0.3;
    // How often to check for new chunks and schedule them (in milliseconds).
    this.chunkProcessInterval = 100;
  }

  /**
   * Adds a new audio chunk to the playback queue.
   */
  addChunk(chunk) {
    const MAX_CHUNK_LENGTH = 10240;
    if (chunk.length > MAX_CHUNK_LENGTH) {
      let segnb = 0;
      for (let i = 0; i < chunk.length; i += MAX_CHUNK_LENGTH) {
        segnb++;
        const chunkSegment = chunk.slice(i, i + MAX_CHUNK_LENGTH);
        const float32ArrayChunk = this.processChunk(chunkSegment);
        if (float32ArrayChunk) this.audioQueue.push(float32ArrayChunk);
      }
    } else {
      const float32ArrayChunk = this.processChunk(chunk);
      if (float32ArrayChunk) this.audioQueue.push(float32ArrayChunk);
    }
  }

  /**
   * Starts the playback loop.
   */
  async play() {
    if (this.isPlaying) {
      return;
    }
    if (this.context.state === 'suspended') {
      await this.context.resume();
    }
    this.isPlaying = true;
    // Initialize nextPlayTime to be slightly in the future.
    if (this.nextPlayTime == 0) {
      this.nextPlayTime = this.context.currentTime + 0.2;
    }

    // DEBUG: Increase this timer to a large number (e.g. 10000 for 10 seconds)
    // to force concatenation of all the first response chunks in one single buffer
    // to check if incoming audio is clean.
    setTimeout(
      () => {
        // After the initial timeout time, playback will be run every
        // `chunkProcessInterval` milliseconds.
        this.schedulingInterval = setInterval(
          () => this._schedulePlayback(),
          this.chunkProcessInterval
        );
      }, 0 
    );
  }

  /**
   * Stops the playback loop and clears the queue.
   */
  stop() {
    if (this.currentSource) {
      try {
        this.audioQueue = []; // Clear the queue for next chunks
        this.currentSource.stop();
        this.currentSource.disconnect();
      // eslint-disable-next-line no-unused-vars
      } catch (e) {
        // Ignore if already stopped
      }
    }
    this.isPlaying = false;
    clearInterval(this.schedulingInterval);
    this.schedulingInterval = null;
    this.audioQueue = []; // Clear any pending audio
    this.nextPlayTime = 0;
    this.chunksPlayed = 0;
    this.clipsPlayed = 0;
  }

  /**
   * The core scheduling logic. This method is called periodically to
   * process the audio queue and schedule playback.
   * @private
   */
  _schedulePlayback() {
    const MAX_CHUNKS_TO_PLAY = 10;
    if (this.audioQueue.length == 0) return;
    // Schedule audio only when we have room in the timeline.
    while (
      this.audioQueue.length > 0 &&
      this.nextPlayTime < this.context.currentTime + this.scheduleAheadTime
    ) {
      // Concatenate all chunks currently in the queue.
      const chunksToPlay = this.audioQueue.splice(0, MAX_CHUNKS_TO_PLAY);

      let totalLength = 0;
      for (const chunk of chunksToPlay) {
        totalLength += chunk.length;
      }

      if (totalLength === 0) {
        continue;
      }

      const concatenatedBuffer = new Float32Array(totalLength);
      let offset = 0;
      for (const chunk of chunksToPlay) {
        concatenatedBuffer.set(chunk, offset);
        offset += chunk.length;
        this.chunksPlayed++;
      }

      // Create an AudioBuffer from the concatenated data.
      const audioBuffer = this.context.createBuffer(
        this.numChannels,
        concatenatedBuffer.length,
        this.sampleRate
      );

      // For mono, copy to channel 0.
      audioBuffer.copyToChannel(concatenatedBuffer, 0);
      let audioBufferDuration = audioBuffer.duration/this.playbackRate;

      // Create a source node and connect it to the destination.
      const source = this.context.createBufferSource();
      source.playbackRate.value = this.playbackRate;
      this.clipsPlayed++;

      source.onended = () => {
        let clipStarted = this.startTimes.shift();
        Logger.debug(`[${this.context.currentTime}] audio clip ended playing with actual duration: ${this.context.currentTime-clipStarted}`);
        // If nothing remains to be played from the current buffer, reset the next play time
        if (this.startTimes.length == 0) {
          // If no additional audio is pending, stop the stream and notify listeners
          if (this.audioQueue.length == 0) {
            this.nextPlayTime = 0;
            this.stop();
            this.onComplete();
          }
        }
      };

      // To avoid a clicking sound when audio starts playing, we fade-in audio playback
      // starting from near silence to full volume.
      if (this.fadeIn && (this.startTimes.length == 0 || this.clipsPlayed == this.chunksPlayed)) {
        this.gainNode.gain.setValueAtTime(0.0001, this.nextPlayTime); // Start at near silence
        this.gainNode.gain.exponentialRampToValueAtTime(1.0, this.nextPlayTime + FADE_IN_END_SECONDS);
      } else {
        this.gainNode.gain.setValueAtTime(1, this.nextPlayTime); // Start at full volume
      }

      source.buffer = audioBuffer;
      //gainNode.connect(this.context.destination);
      source.connect(this.gainNode);

      // Schedule it to play at the calculated time.
      Logger.debug(`[${this.context.currentTime}] scheduling audio clip (${chunksToPlay.length} chunks) at ${this.nextPlayTime} with expected duration ${audioBufferDuration}. Next expected at ${this.nextPlayTime + audioBufferDuration}`);
      source.start(this.nextPlayTime);
      // save the start time, so we can calculate the actual clip duration
      this.startTimes.push(this.nextPlayTime);
      this.currentSource = source;

      // **This is the key to seamless playback:**
      // Update the time for the *next* chunk to start, which is exactly
      // when this one is scheduled to finish.
      this.nextPlayTime += audioBufferDuration;
    }
  }
}
