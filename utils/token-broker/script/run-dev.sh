#!/bin/bash

source $(dirname "$0")/values.sh

functions-framework --target $ENTRY_POINT --debug
