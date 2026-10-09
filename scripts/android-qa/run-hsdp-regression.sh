#!/usr/bin/env bash
set -euo pipefail

DIRECTORY=${1:?Expected directory for official HSDP AAR downloads}
SCRIPT_DIRECTORY=$(cd "$(dirname "$0")" && pwd)
mkdir -p "$DIRECTORY"
for version in 2.0.1 2.2.0; do
    if [ ! -f "$DIRECTORY/hsdp-$version.aar" ]; then
        curl --fail --silent --show-error --location --retry 3 --max-time 120 \
            "https://dl.google.com/dl/android/maven2/com/google/android/play/hsdp/$version/hsdp-$version.aar" \
            --output "$DIRECTORY/hsdp-$version.aar"
    fi
done
java "$SCRIPT_DIRECTORY/HsdpNullExtrasHarness.java" "$DIRECTORY"
