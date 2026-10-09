#!/usr/bin/env bash
set -euo pipefail

ROOT=$(cd "$(dirname "$0")/../.." && pwd)
SOURCE_SHA=${1:?Expected reviewed source SHA}
API=${2:?Expected API30 or API35}
STATE=${3:?Expected new external evidence/state directory}
[[ "$SOURCE_SHA" =~ ^[a-f0-9]{40}$ ]]
[[ "$API" == 30 || "$API" == 35 ]]
[[ "$(git -C "$ROOT" rev-parse HEAD)" == "$SOURCE_SHA" ]]
test -z "$(git -C "$ROOT" status --porcelain)"
test ! -e "$STATE"
STATE=$(realpath -m "$STATE")
[[ "$STATE" != "$ROOT" && "$STATE" != "$ROOT/"* ]]
mkdir -p "$STATE/evidence" "$STATE/home" "$STATE/gradle" "$STATE/android/avd"
exec > >(tee "$STATE/evidence/run.log") 2>&1
printf 'Source %s; API %s; no host permissions will be changed\n' "$SOURCE_SHA" "$API"
id
stat /dev/kvm
test -r /dev/kvm && test -w /dev/kvm
: "${JAVA_HOME:?Existing full JDK17 required}"
: "${ANDROID_HOME:?Existing official Android SDK required}"
"$JAVA_HOME/bin/java" -version 2>&1 | grep -E 'version "17[.\"]'
"$JAVA_HOME/bin/java" -m jdk.compiler/com.sun.tools.javac.Main -version
command -v node git curl unzip timeout
AVAILABLE=$(df -Pk "$STATE" | awk 'NR==2 {print $4}')
test "$AVAILABLE" -ge 16777216
if [ -n "${ANDROID_SDK_ROOT:-}" ]; then test "$ANDROID_SDK_ROOT" = "$ANDROID_HOME"; fi
test -s "$ANDROID_HOME/licenses/android-sdk-license"
NODE=$(command -v node)
SDK_MANAGER="$ANDROID_HOME/cmdline-tools/latest/bin/sdkmanager"
test -x "$SDK_MANAGER"
grep -Eq '^Pkg.Revision[[:space:]]*=[[:space:]]*12\.0$' "$ANDROID_HOME/cmdline-tools/latest/source.properties"

exec env -i HOME="$STATE/home" PATH="$PATH" JAVA_HOME="$JAVA_HOME" \
    ANDROID_HOME="$ANDROID_HOME" ANDROID_SDK_ROOT="$ANDROID_HOME" \
    ANDROID_USER_HOME="$STATE/android" ANDROID_AVD_HOME="$STATE/android/avd" \
    GRADLE_USER_HOME="$STATE/gradle" SOURCE_SHA="$SOURCE_SHA" API="$API" STATE="$STATE" ROOT="$ROOT" NODE="$NODE" \
    bash "$ROOT/qa/hsdp-device/run-isolated.sh"
