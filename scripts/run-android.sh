#!/usr/bin/env bash
set -e

# Use ANDROID_HOME or ANDROID_SDK_ROOT (default common SDK path on macOS)
export ANDROID_HOME="${ANDROID_HOME:-${ANDROID_SDK_ROOT:-$HOME/Library/Android/sdk}}"
EMULATOR="${ANDROID_HOME}/emulator/emulator"
ADB="${ANDROID_HOME}/platform-tools/adb"

# Check if any Android device/emulator is already connected
DEVICES=$("${ADB}" devices 2>/dev/null | grep -E 'emulator|device' | grep -v 'List of' || true)
if [ -n "$DEVICES" ]; then
  echo "Android device/emulator already running. Starting Expo..."
  exec env CI=false npx expo start --android
fi

# No device: list AVDs and start the first one
if [ ! -x "$EMULATOR" ]; then
  echo "Android emulator not found at $EMULATOR. Set ANDROID_HOME or install Android Studio."
  exit 1
fi

AVDS=$("$EMULATOR" -list-avds 2>/dev/null | head -1)
if [ -z "$AVDS" ]; then
  echo "No AVDs found. Create one in Android Studio: Device Manager → Create Device."
  exit 1
fi

echo "Starting emulator: $AVDS"
"$EMULATOR" -avd "$AVDS" -no-snapshot-load &
EMU_PID=$!

echo "Waiting for emulator to boot..."
"$ADB" wait-for-device
# Wait for boot to complete so Expo can install
while [ "$("$ADB" shell getprop sys.boot_completed 2>/dev/null | tr -d '\r')" != "1" ]; do
  sleep 2
done

echo "Emulator ready. Starting Expo..."
exec env CI=false npx expo start --android
