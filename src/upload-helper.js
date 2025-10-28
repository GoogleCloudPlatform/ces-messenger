/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { ref } from 'vue';
import { Logger } from '@/logger.js';

/**
 * Manages image uploads for the Bidi Widget.
 */
export class UploadHelper {
  /**
   * @param {object} agentConfig The agent configuration.
   */
  constructor(agentConfig, imgUploadQueue, showUploadOverlay) {
    this.agentConfig = agentConfig;
    this.imgUploadQueue = imgUploadQueue;
    this.showUploadOverlay = showUploadOverlay;
    this.canTakePicture = false;
    this.logger = new Logger();

    this.detectCamera();
  }

  /**
   * Detects if a camera is available for taking pictures.
   */
  async detectCamera() {
    if (navigator.mediaDevices && navigator.mediaDevices.enumerateDevices) {
      try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const isMobile = /Mobi/i.test(navigator.userAgent);
        this.canTakePicture.value = isMobile && devices.some(device => device.kind === 'videoinput');
      } catch (error) {
        this.logger.warn('Could not detect camera:', error);
      }
    }
  }

  /** Toggles the visibility of the upload overlay. */
  uploadFile() {
    console.log('uploadFile clicked');
    this.showUploadOverlay.value = !this.showUploadOverlay.value;
  }

  /** Triggers the file upload dialog. */
  triggerFileUpload() {
    this.showUploadOverlay.value = false;
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.multiple = true;
    input.onchange = async (event) => {
      const files = event.target.files;
      if (files.length > 0) {
        for (const file of files) {
          if (this.imgUploadQueue.value.length >= this.agentConfig.imageUploadMaxNumber) {
            this.logger.warn('maximum number of image uploads reached. Ignoring image.');
            continue;
          }
          try {
            const resizedImageDataUrl = await this.resizeImage(file, this.agentConfig.imageUploadMaxWidth, this.agentConfig.imageUploadMaxHeight);
            this.imgUploadQueue.value.push(resizedImageDataUrl);
            console.log
          } catch (error) {
            this.logger.error('Error resizing image:', error);
          }
        }
      }
    };
    input.click();
  }

  /** Triggers the camera capture interface. */
  triggerCameraCapture() {
    if (this.imgUploadQueue.value.length >= this.agentConfig.imageUploadMaxNumber) {
      this.logger.warn('maximum number of image uploads reached. Ignoring image.');
      return;
    }
    this.showUploadOverlay.value = false;
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.capture = 'user';
    input.onchange = async (event) => {
      const files = event.target.files;
      if (files.length > 0) {
        const file = files[0];
        try {
          const resizedImageDataUrl = await this.resizeImage(file);
          this.imgUploadQueue.value.push(resizedImageDataUrl);
        } catch (error) {
          this.logger.error('Error processing image from camera:', error);
        }
      }
    };
    input.click();
  }

  /** @param {number} index The index of the image to remove. */
  removeImage(index) {
    this.imgUploadQueue.value.splice(index, 1);
  }

  async resizeImage(file, maxWidth = 800, maxHeight = 800) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          let { width, height } = img;

          if (width > maxWidth || height > maxHeight) {
            if (width > height) {
              height = Math.round(height * (maxWidth / width));
              width = maxWidth;
            } else {
              width = Math.round(width * (maxHeight / height));
              height = maxHeight;
            }
          }

          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, width, height);
          resolve(canvas.toDataURL('image/jpeg'));
        };
        img.onerror = reject;
        img.src = e.target.result;
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }


}