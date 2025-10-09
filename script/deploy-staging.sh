#!/bin/bash

# @license
# Copyright 2025 Google LLC
# SPDX-License-Identifier: Apache-2.0

npm run build
firebase deploy --only hosting:agent-kite-stg
