#!/usr/bin/env bash
set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ABIS="${YIFY_STORE_ABIS:-armeabi-v7a,arm64-v8a}"
OUT_DIR="$PROJECT_ROOT/store-artifacts"
APK="$PROJECT_ROOT/android/app/build/outputs/apk/release/app-release.apk"

if [ -z "${JAVA_HOME:-}" ] || [ ! -x "$JAVA_HOME/bin/javac" ]; then
  JAVA_HOME="$(/usr/libexec/java_home -v 17 2>/dev/null || true)"
  if [ -z "$JAVA_HOME" ]; then
    for jdk in /opt/homebrew/opt/openjdk@17/libexec/openjdk.jdk/Contents/Home \
               /usr/local/opt/openjdk@17/libexec/openjdk.jdk/Contents/Home; do
      [ -x "$jdk/bin/javac" ] && JAVA_HOME="$jdk" && break
    done
  fi
fi
if [ -z "${JAVA_HOME:-}" ] || [ ! -x "$JAVA_HOME/bin/javac" ]; then
  echo "JDK 17 not found. Install with: brew install openjdk@17"
  exit 1
fi
export JAVA_HOME
export ANDROID_HOME="${ANDROID_HOME:-${ANDROID_SDK_ROOT:-$HOME/Library/Android/sdk}}"

VERSION="$(python3 -c "import json;print(json.load(open('$PROJECT_ROOT/package.json'))['version'])")"
CODE="$(python3 -c "import json;print(json.load(open('$PROJECT_ROOT/package.json'))['versionCode'])")"

echo "Configuring release signing..."
bash "$PROJECT_ROOT/scripts/setup-android-signing.sh"

SIGNING_ENV="${YIFY_SIGNING_ENV:-$HOME/.config/yify/signing.env}"
set -a
. "$SIGNING_ENV"
set +a
EXPECTED_SHA1="$(echo "$YIFY_UPLOAD_EXPECTED_SHA1" | tr -d ':' | tr '[:upper:]' '[:lower:]')"

echo "Building universal release APK ($ABIS)..."
rm -f "$APK"
(cd "$PROJECT_ROOT/android" && ./gradlew assembleRelease \
  -PreactNativeArchitectures="$ABIS" --console=plain -q)

[ -f "$APK" ] || { echo "Build produced no APK at $APK"; exit 1; }

BUILD_TOOLS="$(ls -d "$ANDROID_HOME"/build-tools/* 2>/dev/null | sort -V | tail -1)"
[ -n "$BUILD_TOOLS" ] || { echo "No Android build-tools found under $ANDROID_HOME"; exit 1; }

ACTUAL_SHA1="$("$BUILD_TOOLS/apksigner" verify --print-certs "$APK" \
  | grep -i "certificate SHA-1 digest" | head -1 | sed 's/.*: //' | tr -d ' ' | tr '[:upper:]' '[:lower:]')"

if [ "$ACTUAL_SHA1" != "$EXPECTED_SHA1" ]; then
  echo "APK is not signed with the release key."
  echo "  expected: $EXPECTED_SHA1"
  echo "  actual:   ${ACTUAL_SHA1:-<unsigned>}"
  echo "A debug-signed artifact must never reach a store. Aborting."
  exit 1
fi

FOUND_ABIS="$(unzip -l "$APK" | awk '/lib\//{split($4,p,"/"); print p[2]}' | sort -u | paste -sd, -)"
EXPECTED_ABIS="$(echo "$ABIS" | tr ',' '\n' | sort -u | paste -sd, -)"
if [ "$FOUND_ABIS" != "$EXPECTED_ABIS" ]; then
  echo "APK carries unexpected ABIs."
  echo "  expected: $EXPECTED_ABIS"
  echo "  actual:   $FOUND_ABIS"
  exit 1
fi

mkdir -p "$OUT_DIR"
TARGET="$OUT_DIR/yify-$VERSION-$CODE.apk"
cp "$APK" "$TARGET"

SIZE="$(python3 -c "import os;print(f'{os.path.getsize(\"$TARGET\")/1048576:.1f}')")"
echo
echo "Store APK ready"
echo "  path:        $TARGET"
echo "  version:     $VERSION ($CODE)"
echo "  abis:        $FOUND_ABIS"
echo "  size:        ${SIZE} MB"
echo "  signed sha1: $ACTUAL_SHA1"
