#!/usr/bin/env bash
set -e

export APP_VARIANT=debug
# Use ANDROID_HOME or ANDROID_SDK_ROOT (default common SDK path on macOS)
export ANDROID_HOME="${ANDROID_HOME:-${ANDROID_SDK_ROOT:-$HOME/Library/Android/sdk}}"
EMULATOR="${ANDROID_HOME}/emulator/emulator"
ADB="${ANDROID_HOME}/platform-tools/adb"

# Find Java (Gradle needs it). Prefer: existing JAVA_HOME → Android Studio JBR → macOS java_home → Homebrew
if [ -z "$JAVA_HOME" ] || [ ! -x "$JAVA_HOME/bin/javac" ]; then
  if [ -d "/Applications/Android Studio.app/Contents/jbr/Contents/Home" ]; then
    export JAVA_HOME="/Applications/Android Studio.app/Contents/jbr/Contents/Home"
  elif command -v /usr/libexec/java_home &>/dev/null; then
    export JAVA_HOME=$(/usr/libexec/java_home -v 17 2>/dev/null || /usr/libexec/java_home -v 11 2>/dev/null || true)
  fi
  if [ -z "$JAVA_HOME" ]; then
    for jdk in /opt/homebrew/opt/openjdk@17/libexec/openjdk.jdk/Contents/Home \
               /opt/homebrew/opt/openjdk@11/libexec/openjdk.jdk/Contents/Home \
               /usr/local/opt/openjdk@17/libexec/openjdk.jdk/Contents/Home; do
      if [ -x "$jdk/bin/javac" ]; then
        export JAVA_HOME="$jdk"
        break
      fi
    done
  fi
  if [ -z "$JAVA_HOME" ] || [ ! -x "$JAVA_HOME/bin/javac" ]; then
    echo "Java (JDK 17 or 11) not found. Install with: brew install openjdk@17"
    echo "Or use Android Studio (it bundles a JDK)."
    exit 1
  fi
fi

# Check if any Android device/emulator is already connected
DEVICES=$("${ADB}" devices 2>/dev/null | grep -E 'emulator|device' | grep -v 'List of' || true)
if [ -z "$DEVICES" ]; then
  # No device: start emulator
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

# Prebuild with debug package (.debug suffix), then build and install debug APK
echo "Prebuilding Android (debug package: io.github.kunal26das.yify.debug)..."
npx expo prebuild --platform android --clean
echo "Building and installing debug app..."
exec env CI=false npx expo run:android --variant debug
