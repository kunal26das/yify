#!/usr/bin/env bash
set -euo pipefail

PACKAGE_NAME=io.github.kunal26das.yify
CANDIDATE=scripts/android-qa/production-aab-candidate.json
BUNDLETOOL="$RUNNER_TEMP/bundletool.jar"
AAB="$RUNNER_TEMP/production.aab"
KEYSTORE="$RUNNER_TEMP/apk-test.jks"

node scripts/verify-production-aab.mjs candidate "$CANDIDATE"
node scripts/verify-production-aab.mjs bundle "$CANDIDATE" "$BUNDLETOOL" "$AAB"
bash scripts/wait-production-aab-emulator-ready.sh
adb shell cmd connectivity airplane-mode enable
adb shell svc wifi disable
adb shell svc data disable
adb shell iptables -P OUTPUT DROP
adb shell ip6tables -P OUTPUT DROP
adb shell iptables -I OUTPUT 1 -j DROP
adb shell ip6tables -I OUTPUT 1 -j DROP
adb shell iptables -S OUTPUT | tr -d '\r' | grep -qx -- '-P OUTPUT DROP'
adb shell ip6tables -S OUTPUT | tr -d '\r' | grep -qx -- '-P OUTPUT DROP'
test "$(adb shell iptables -S OUTPUT | tr -d '\r' | sed -n '2p')" = '-A OUTPUT -j DROP'
test "$(adb shell ip6tables -S OUTPUT | tr -d '\r' | sed -n '2p')" = '-A OUTPUT -j DROP'
test "$(adb shell settings get global airplane_mode_on | tr -d '\r')" = 1

java -jar "$BUNDLETOOL" get-device-spec --output="$RUNNER_TEMP/device-spec.json"
java -jar "$BUNDLETOOL" build-apks \
    --bundle="$AAB" --output="$RUNNER_TEMP/device.apks" \
    --device-spec="$RUNNER_TEMP/device-spec.json" \
    --ks="$KEYSTORE" --ks-key-alias=isolated-test \
    --ks-pass=pass:local-verification-only --key-pass=pass:local-verification-only
java -jar "$BUNDLETOOL" extract-apks \
    --apks="$RUNNER_TEMP/device.apks" --device-spec="$RUNNER_TEMP/device-spec.json" \
    --output-dir="$RUNNER_TEMP/device-apks"
mapfile -d '' APKS < <(find "$RUNNER_TEMP/device-apks" -type f -name '*.apk' -print0)
test "${#APKS[@]}" -gt 0
AAPT2=$(find "$ANDROID_HOME/build-tools" -name aapt2 -type f | sort -V | tail -n 1)
test -n "$AAPT2"
node scripts/check-android-native-libs.mjs --abis x86_64 --aapt2 "$AAPT2" \
    "${APKS[@]}" > "$RUNNER_TEMP/device-native-check.json"
node scripts/verify-production-aab.mjs apks "$CANDIDATE" "$AAB" "$RUNNER_TEMP/device-native-check.json"
BASE_APK=$(node -e "const result=require(process.argv[1]); const base=result.artifacts.find(apk=>!apk.split); if(!base) process.exit(1); process.stdout.write(base.path)" "$RUNNER_TEMP/device-native-check.json")
OTHER_APKS=()
: > "$RUNNER_TEMP/device-apk-signers.txt"
for apk in "${APKS[@]}"; do
    "$(dirname "$AAPT2")/apksigner" verify --print-certs "$apk" | \
        sed -n 's/^Signer #1 certificate SHA-256 digest: //p' >> "$RUNNER_TEMP/device-apk-signers.txt"
    if [ "$apk" != "$BASE_APK" ]; then OTHER_APKS+=("$apk"); fi
done
adb install-multiple --no-streaming "$BASE_APK" "${OTHER_APKS[@]}" >/dev/null
test "$(adb shell pm list packages "$PACKAGE_NAME" | tr -d '\r')" = "package:$PACKAGE_NAME"
adb shell dumpsys package "$PACKAGE_NAME" > "$RUNNER_TEMP/installed-package.txt"
adb shell pm path "$PACKAGE_NAME" | tr -d '\r' > "$RUNNER_TEMP/installed-apk-paths.txt"
mkdir -p "$RUNNER_TEMP/installed-apks"
index=0
while IFS= read -r installed; do
    case "$installed" in package:/*) ;;
        *) echo 'Unexpected installed APK path' >&2; exit 1 ;;
    esac
    adb exec-out cat "${installed#package:}" > "$RUNNER_TEMP/installed-apks/$index.apk"
    index=$((index + 1))
done < "$RUNNER_TEMP/installed-apk-paths.txt"
test "$index" -eq "${#APKS[@]}"
adb logcat -c
adb shell am start -W -n "$PACKAGE_NAME/.MainActivity" > "$RUNNER_TEMP/launch.txt"
grep -q '^Status: ok' "$RUNNER_TEMP/launch.txt"
INITIAL_PID=$(adb shell pidof -s "$PACKAGE_NAME" | tr -d '\r')
test -n "$INITIAL_PID"
sleep 20
test "$(adb shell pidof -s "$PACKAGE_NAME" | tr -d '\r')" = "$INITIAL_PID"
adb shell dumpsys activity activities > "$RUNNER_TEMP/activity.txt"
grep -E 'mResumedActivity|topResumedActivity' "$RUNNER_TEMP/activity.txt" | grep -Fq "$PACKAGE_NAME/.MainActivity"
adb shell dumpsys window > "$RUNNER_TEMP/window.txt"
grep -E 'mCurrentFocus|mFocusedApp' "$RUNNER_TEMP/window.txt" | grep -Fq "$PACKAGE_NAME/.MainActivity"
adb logcat -d -b events -v brief > "$RUNNER_TEMP/events.log"
adb logcat -d -v brief -s AndroidRuntime:E libc:F DEBUG:E ActivityManager:E > "$RUNNER_TEMP/crashes.log"
if grep -E 'am_(crash|anr).*io\.github\.kunal26das\.yify' "$RUNNER_TEMP/events.log" >/dev/null ||
    grep -F "Process: $PACKAGE_NAME," "$RUNNER_TEMP/crashes.log" >/dev/null ||
    grep -F "ANR in $PACKAGE_NAME" "$RUNNER_TEMP/crashes.log" >/dev/null ||
    grep -E "Fatal signal.*(pid $INITIAL_PID|io\.github\.kunal26das\.yify)" "$RUNNER_TEMP/crashes.log" >/dev/null; then
    echo 'App crash, ANR or native failure detected' >&2
    exit 1
fi
adb shell uiautomator dump /sdcard/yify-verification-ui.xml >/dev/null
adb pull /sdcard/yify-verification-ui.xml "$RUNNER_TEMP/yify-verification-ui.xml" >/dev/null
adb exec-out screencap -p > "$RUNNER_TEMP/yify-verification-screen.png"
adb shell iptables -S OUTPUT | tr -d '\r' | grep -qx -- '-P OUTPUT DROP'
adb shell ip6tables -S OUTPUT | tr -d '\r' | grep -qx -- '-P OUTPUT DROP'
test "$(adb shell iptables -S OUTPUT | tr -d '\r' | sed -n '2p')" = '-A OUTPUT -j DROP'
test "$(adb shell ip6tables -S OUTPUT | tr -d '\r' | sed -n '2p')" = '-A OUTPUT -j DROP'
APP_PID="$INITIAL_PID" node --input-type=module <<'NODE'
import {createHash} from 'node:crypto';
import {readFileSync, readdirSync, writeFileSync} from 'node:fs';
import {loadCandidate, verifyAabHash, verifyApkResult, verifyInstallEvidence} from './scripts/verify-production-aab.mjs';
const directory = process.env.RUNNER_TEMP;
const candidate = loadCandidate('scripts/android-qa/production-aab-candidate.json');
const aabSha256 = verifyAabHash(`${directory}/production.aab`, candidate);
const universal = JSON.parse(readFileSync(`${directory}/universal-native-check.json`, 'utf8'));
verifyApkResult(universal, candidate);
if (Object.keys(universal.abis).sort().join(',') !== 'arm64-v8a,armeabi-v7a,x86,x86_64' ||
    Object.values(universal.abis).some(count => count < 3)) throw new Error('Four-ABI packaging check is incomplete');
const apkResult = JSON.parse(readFileSync(`${directory}/device-native-check.json`, 'utf8'));
verifyApkResult(apkResult, candidate);
const installed = readdirSync(`${directory}/installed-apks`).map(name =>
    createHash('sha256').update(readFileSync(`${directory}/installed-apks/${name}`)).digest('hex')).sort();
const packageDump = readFileSync(`${directory}/installed-package.txt`, 'utf8');
const signers = readFileSync(`${directory}/device-apk-signers.txt`, 'utf8').trim().split(/\r?\n/);
const installedSigner = verifyInstallEvidence(apkResult, installed, signers, packageDump, candidate);
const deviceSpec = JSON.parse(readFileSync(`${directory}/device-spec.json`, 'utf8'));
const screen = readFileSync(`${directory}/yify-verification-screen.png`);
const ui = readFileSync(`${directory}/yify-verification-ui.xml`, 'utf8');
const packageName = 'io.github.kunal26das.yify';
const nodeCount = ui.split(`package="${packageName}"`).length - 1;
if (!screen.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])) ||
    screen.length < 5000 || screen.readUInt32BE(16) < 200 || screen.readUInt32BE(20) < 200 || nodeCount < 1) {
    throw new Error('No rendered app UI evidence');
}
writeFileSync(`${directory}/yify-verification-receipt.json`, JSON.stringify({
    buildId: candidate.buildId, sourceSha: candidate.sourceSha, aabSha256,
    projectId: candidate.projectId, packageName, version: candidate.version,
    versionCode: candidate.versionCode, runtime: candidate.runtime,
    aabUploadCertSha256: candidate.uploadCertSha256,
    installedApkSignerSha256: installedSigner, apkSigning: 'ephemeral-test',
    fourAbiNativeLibraries: universal.abis, installedApkSha256: installed, deviceSpec, abi: 'x86_64',
    appPid: process.env.APP_PID, stableProcessSeconds: 20, foregroundActivity: 'MainActivity',
    ipv4AndIpv6Blocked: true, appUiNodes: nodeCount, screenshotSha256: createHash('sha256').update(screen).digest('hex'),
    checks: {bundleIdentity: 'passed', fourAbiPackaging: 'passed', deviceInstallAndSmoke: 'passed', connectedJourneys: 'not-executed'},
}, null, 2));
NODE
echo 'Installed and rendered AAB-derived x86_64 split APKs; original app process survived 20 seconds with IPv4 and IPv6 egress blocked'
