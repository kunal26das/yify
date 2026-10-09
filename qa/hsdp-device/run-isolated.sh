#!/usr/bin/env bash
set -euo pipefail

SDK_MANAGER="$ANDROID_HOME/cmdline-tools/latest/bin/sdkmanager"
IMAGE="system-images;android-$API;google_apis;x86_64"
"$SDK_MANAGER" --list --channel=0 </dev/null > "$STATE/evidence/sdk-inventory.txt"
for package in 'platforms;android-37.0' 'build-tools;37.0.0' platform-tools emulator "$IMAGE"; do
    grep -F "$package " "$STATE/evidence/sdk-inventory.txt" >/dev/null || {
        echo "Required official stable SDK package is unavailable: $package" >&2
        exit 1
    }
done
"$SDK_MANAGER" --install --channel=0 'platforms;android-37.0' 'build-tools;37.0.0' platform-tools emulator "$IMAGE" </dev/null
"$NODE" "$ROOT/qa/hsdp-device/check-sdk.mjs" "$ANDROID_HOME" "$API" "$STATE/evidence/prerequisites.json"
"$ANDROID_HOME/emulator/emulator" -accel-check
"$NODE" --test "$ROOT/tests/hsdp-device.test.cjs"
bash "$ROOT/android/gradlew" --project-dir "$ROOT/qa/hsdp-device" --no-daemon --no-configuration-cache \
    -PsourceSha="$SOURCE_SHA" :app:assembleLegacyDebug :app:assembleFixedDebug --console=plain
test -z "$(git -C "$ROOT" status --porcelain)"
AAPT2="$ANDROID_HOME/build-tools/37.0.0/aapt2"
"$NODE" "$ROOT/qa/hsdp-device/verify-apks.mjs" "$ROOT/qa/hsdp-device" "$AAPT2" "$SOURCE_SHA" "$STATE/evidence"
AVD="yify-hsdp-$API-${SOURCE_SHA:0:12}"
printf 'no\n' | "$ANDROID_HOME/cmdline-tools/latest/bin/avdmanager" create avd --name "$AVD" --package "$IMAGE" --device pixel_2
"$ANDROID_HOME/emulator/emulator" -avd "$AVD" -port 5580 -no-snapshot -no-window \
    -no-audio -no-boot-anim -camera-back none -camera-front none -no-metrics -accel on -gpu swiftshader_indirect \
    > "$STATE/evidence/emulator.log" 2>&1 &
EMULATOR_PID=$!
cleanup() {
    if [ "$($ANDROID_HOME/platform-tools/adb -s emulator-5580 emu avd name 2>/dev/null | head -n 1 | tr -d '\r')" = "$AVD" ]; then
        "$ANDROID_HOME/platform-tools/adb" -s emulator-5580 emu kill >/dev/null 2>&1 || true
    fi
    kill "$EMULATOR_PID" 2>/dev/null || true
    wait "$EMULATOR_PID" 2>/dev/null || true
}
trap cleanup EXIT
ADB="$ANDROID_HOME/platform-tools/adb"
export ANDROID_SERIAL=emulator-5580
timeout 180 "$ADB" -s "$ANDROID_SERIAL" wait-for-device
"$ADB" -s "$ANDROID_SERIAL" root
timeout 180 "$ADB" -s "$ANDROID_SERIAL" wait-for-device
READY=false
for attempt in $(seq 1 180); do
    if [ "$("$ADB" -s "$ANDROID_SERIAL" shell getprop sys.boot_completed 2>/dev/null | tr -d '\r')" = 1 ]; then READY=true; break; fi
    kill -0 "$EMULATOR_PID"
    sleep 3
done
[ "$READY" = true ] || { echo 'Emulator boot did not complete' >&2; exit 1; }
"$NODE" "$ROOT/qa/hsdp-device/run-device.mjs" "$ADB" "$ANDROID_SERIAL" "$ROOT/qa/hsdp-device" \
    "$SOURCE_SHA" "$API" "$STATE/evidence" "$AVD"
