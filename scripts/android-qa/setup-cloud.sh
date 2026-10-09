#!/usr/bin/env bash
set -euo pipefail

ROOT=${1:?Expected isolated source checkout}
SOURCE_SHA=${2:?Expected immutable source SHA}
STATE=${3:?Expected external state directory}
SCRIPT_DIRECTORY=$(cd "$(dirname "$0")" && pwd)
ROOT=$(cd "$ROOT" && pwd)
mkdir -p "$STATE"
STATE=$(cd "$STATE" && pwd)
case "$STATE/" in "$ROOT/"*) echo 'QA state must be outside the source checkout' >&2; exit 1 ;; esac
node "$SCRIPT_DIRECTORY/preflight.mjs" inspect "$ROOT" "$SOURCE_SHA" bootstrap > "$STATE/bootstrap.json"
if node "$SCRIPT_DIRECTORY/preflight.mjs" reuse "$ROOT" "$SOURCE_SHA" build "$STATE/prerequisites.json"; then
    echo 'Reusing verified prerequisites; source, package metadata, executables, and toolchain fingerprint still match'
    exit 0
fi
mapfile -t PACKAGES < <(node "$SCRIPT_DIRECTORY/preflight.mjs" sdk-packages)
"$ANDROID_HOME/cmdline-tools/latest/bin/sdkmanager" --install "${PACKAGES[@]}" </dev/null
cd "$ROOT"
ELECTRON_SKIP_BINARY_DOWNLOAD=1 EXPO_NO_TELEMETRY=1 EXPO_NO_DOTENV=1 yarn install --frozen-lockfile --non-interactive
node "$SCRIPT_DIRECTORY/preflight.mjs" save "$ROOT" "$SOURCE_SHA" build "$STATE/prerequisites.json"
