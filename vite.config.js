/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { fileURLToPath, URL } from 'node:url'

import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

// https://vite.dev/config/
export default defineConfig({
  base: '/',
  plugins: [
    vue({
      template: {
        compilerOptions: {
          isCustomElement: (tag) => ['custom-button'].includes(tag),
        }
      }
    }),
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url))
    },
  },
  build: {
      rollupOptions: {
          output: {
              dir: 'dist/',
              entryFileNames: 'ces-messenger.js',
              chunkFileNames: "ces-messenger.js",
              manualChunks: undefined,
          }
      },
      assetsInlineLimit: Number.MAX_SAFE_INTEGER,
  }
})
