#!/usr/bin/env bash
set -euo pipefail

SDK=${1:?Expected official Android SDK root}
EVIDENCE=${2:?Expected external evidence directory}
SCRIPT_DIRECTORY=$(cd "$(dirname "$0")" && pwd)
mkdir -p "$EVIDENCE"
SDK_MANAGER="$SDK/cmdline-tools/latest/bin/sdkmanager"
cat "$SDK/cmdline-tools/latest/source.properties" | tee "$EVIDENCE/sdkmanager-metadata.txt"
"$SDK_MANAGER" --version | tee "$EVIDENCE/sdkmanager-version.txt"
"$SDK_MANAGER" --list --channel=0 2>&1 | tee "$EVIDENCE/sdk-inventory-stable.txt"
"$SDK_MANAGER" --list --channel=3 2>&1 | tee "$EVIDENCE/sdk-inventory-all-channels.txt"
node "$SCRIPT_DIRECTORY/preflight.mjs" sdk-packages | tee "$EVIDENCE/requested-sdk-packages.txt"
node "$SCRIPT_DIRECTORY/preflight.mjs" inventory "$EVIDENCE"
