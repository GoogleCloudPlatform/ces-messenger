#!/bin/bash

# @license
# Copyright 2025 Google LLC
# SPDX-License-Identifier: Apache-2.0

export VITE_VERSION=$(date +%Y%m%d.%H%M)
export VITE_DEV_ENDPOINT_WEBCHANNEL="autopush-ces-webchannel-googleapis.sandbox.google.com"
export VITE_DEV_ENDPOINT_HTTP="autopush-ces.sandbox.googleapis.com"

npm run build

