#!/usr/bin/env bash
set -e

export APP_VARIANT=debug
export ANDROID_HOME="${ANDROID_HOME:-${ANDROID_SDK_ROOT:-$HOME/Library/Android/sdk}}"
EMULATOR="${ANDROID_HOME}/emulator/emulator"
ADB="${ANDROID_HOME}/platform-tools/adb"

source "$(dirname "$0")/android-java.sh"

DEVICES=$("${ADB}" devices 2>/dev/null | grep -E 'emulator|device' | grep -v 'List of' || true)
if [ -z "$DEVICES" ]; then
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
  echo "Waiting for emulator to boot..."
  "$ADB" wait-for-device
  while [ "$("$ADB" shell getprop sys.boot_completed 2>/dev/null | tr -d '\r')" != "1" ]; do
    sleep 2
  done
  echo "Emulator ready."
fi

echo "Prebuilding Android (package: io.github.kunal26das.yify)..."
npx expo prebuild --platform android --clean
echo "Building and installing debug app..."
exec env CI=false npx expo run:android --variant debug
