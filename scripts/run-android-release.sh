#!/usr/bin/env bash
set -e

export APP_VARIANT=release
# Use ANDROID_HOME or ANDROID_SDK_ROOT (default common SDK path on macOS)
export ANDROID_HOME="${ANDROID_HOME:-${ANDROID_SDK_ROOT:-$HOME/Library/Android/sdk}}"

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

# Prebuild with release package, then build and install release APK
echo "Prebuilding Android (release package: io.github.kunal26das.yify)..."
npx expo prebuild --platform android --clean
echo "Building and installing release app..."
exec env CI=false npx expo run:android --variant release
