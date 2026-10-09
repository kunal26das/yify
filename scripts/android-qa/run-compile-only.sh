#!/usr/bin/env bash
set -euo pipefail

ROOT=${1:?Expected isolated source checkout}
SOURCE_SHA=${2:?Expected immutable source SHA}
STATE=${3:?Expected external state directory}
ROOT=$(cd "$ROOT" && pwd)
mkdir -p "$STATE"
STATE=$(cd "$STATE" && pwd)
case "$STATE/" in "$ROOT/"*) echo 'QA state must be outside the source checkout' >&2; exit 1 ;; esac
: "${JAVA_HOME:?Provide JDK 17}"
: "${ANDROID_HOME:?Provide the official runner SDK with existing licenses}"
mkdir -p "$STATE/home" "$STATE/gradle" "$STATE/evidence"
if [ "${YIFY_QA_ISOLATED:-}" != "$STATE" ]; then
    exec env -i PATH="$JAVA_HOME/bin:$PATH" HOME="$STATE/home" JAVA_HOME="$JAVA_HOME" \
        ANDROID_HOME="$ANDROID_HOME" ANDROID_SDK_ROOT="$ANDROID_HOME" \
        GRADLE_USER_HOME="$STATE/gradle" CI=1 EXPO_NO_TELEMETRY=1 EXPO_NO_DOTENV=1 \
        SENTRY_DISABLE_AUTO_UPLOAD=true SENTRY_ALLOW_FAILURE=false ELECTRON_SKIP_BINARY_DOWNLOAD=1 \
        YIFY_QA_ISOLATED="$STATE" \
        bash "$ROOT/scripts/android-qa/run-compile-only.sh" "$ROOT" "$SOURCE_SHA" "$STATE"
fi
cd "$ROOT"
bash scripts/android-qa/setup-cloud.sh "$ROOT" "$SOURCE_SHA" "$STATE" 2>&1 | tee "$STATE/evidence/setup.log"
node scripts/check-dependency-pins.mjs 2>&1 | tee "$STATE/evidence/dependency-pins.log"
yarn typecheck 2>&1 | tee "$STATE/evidence/typecheck.log"
yarn test 2>&1 | tee "$STATE/evidence/tests.log"
node scripts/android-qa/run-mock-journeys.mjs "$STATE/evidence/mock-journeys"
bash scripts/android-qa/run-hsdp-regression.sh "$STATE/hsdp" 2>&1 | tee "$STATE/evidence/hsdp-real-bytecode.log"
CI=1 EXPO_NO_GIT_STATUS=1 ./node_modules/.bin/expo prebuild --platform android --no-install --clean \
    2>&1 | tee "$STATE/evidence/prebuild.log"
test -z "$(git status --porcelain -- android)"
node scripts/android-qa/preflight.mjs inspect "$ROOT" "$SOURCE_SHA" build > "$STATE/evidence/build-preflight.json"
cd android
./gradlew --no-daemon -Pandroid.builder.sdkDownload=false \
    -Dhsdp.verify.androidRoot="$PWD" -Dhsdp.verify.ndkVersion=27.1.12297006 \
    -I ../scripts/android-qa/compile-only.gradle -I ../scripts/verify-hsdp.gradle \
    :app:verifyHsdpRuntime 2>&1 | tee "$STATE/evidence/resolved-native-graph.log"
./gradlew --no-daemon -Pandroid.builder.sdkDownload=false \
    -PreactNativeArchitectures=armeabi-v7a,arm64-v8a,x86,x86_64 \
    -I ../scripts/android-qa/compile-only.gradle :app:assembleRelease :app:bundleRelease \
    2>&1 | tee "$STATE/evidence/native-release-compile.log"
cd "$ROOT"
node scripts/check-android-native-libs.mjs --abis armeabi-v7a,arm64-v8a,x86,x86_64 \
    --aapt2 "$ANDROID_HOME/build-tools/37.0.0/aapt2" android/app/build/outputs/apk/release/app-release.apk \
    > "$STATE/evidence/all-abi-packaging.json"
sha256sum android/app/build/outputs/apk/release/app-release.apk android/app/build/outputs/bundle/release/app-release.aab \
    > "$STATE/evidence/artifact-sha256.txt"
test "$(git rev-parse HEAD)" = "$SOURCE_SHA"
test -z "$(git status --porcelain --untracked-files=normal)"
node - "$SOURCE_SHA" "$STATE/evidence/compile-only-receipt.json" <<'JS'
const fs = require('node:fs');
const [sourceSha, output] = process.argv.slice(2);
fs.writeFileSync(output, JSON.stringify({schemaVersion: 1, sourceSha, kind: 'debug-signed-release-compilation',
    passed: ['locked-source-and-js-checks', 'mocked-journey-suites', 'hsdp-real-bytecode-regression',
        'resolved-native-graph', 'full-native-release-compile', 'all-abi-packaging'],
    notRun: ['offline-device-launch', 'consent-and-connected-startup', 'catalog-browsing',
        'sandbox-sign-in', 'sandbox-purchase-and-restore', 'production-signing', 'store-release'],
    productionReady: false}, null, 2) + '\n');
JS
