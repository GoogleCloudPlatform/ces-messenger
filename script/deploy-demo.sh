#!/bin/bash

# @license
# Copyright 2025 Google LLC
# SPDX-License-Identifier: Apache-2.0

VITE_VERSION=$(date +%Y%m%d.%H%M) BASE_PATH="/aiestaran-ps-web-component-demo/" npm run build
mkdir -p demo
cd demo
cp -r ../dist/* .
cp ../tmp/index.html .
gcloud storage cp . gs://aiestaran-ps-web-component-demo --recursive
cd ..
rm -rf demo