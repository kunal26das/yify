#!/usr/bin/env bash
set -e

export APP_VARIANT=release
export ANDROID_HOME="${ANDROID_HOME:-${ANDROID_SDK_ROOT:-$HOME/Library/Android/sdk}}"

source "$(dirname "$0")/android-java.sh"

echo "Prebuilding Android (release package: io.github.kunal26das.yify)..."
npx expo prebuild --platform android --clean

echo "Restoring release signing config..."
bash "$(dirname "$0")/setup-android-signing.sh"

echo "Building and installing release app..."
exec env CI=false npx expo run:android --variant release
