import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {chmodSync, mkdtempSync, readFileSync, rmSync, writeFileSync} from 'node:fs';
import {test} from 'node:test';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {
    BUILD_ID, PACKAGE_NAME, PROJECT_ID, SOURCE_SHA, UPLOAD_CERT_SHA256,
    isAllowedDownloadUrl, verifyBuildMetadata, verifyBundleManifest, verifyCertificate, verifyRuntimeResources,
} from './verify-production-aab.mjs';

const metadata = {
    id: BUILD_ID, status: 'FINISHED', platform: 'ANDROID', app: {id: PROJECT_ID},
    appIdentifier: PACKAGE_NAME, buildProfile: 'production', appVersion: '1.8.15',
    appBuildVersion: '97', runtime: {version: '1.8.15'}, updateChannel: {name: 'Production'}, gitCommitHash: SOURCE_SHA,
    fingerprint: {hash: 'abc'}, artifacts: {buildUrl: 'https://expo.dev/artifacts/eas/build.aab'},
};

test('installs locked app dependencies before querying EAS build metadata', () => {
    const workflow = readFileSync(new URL('../.github/workflows/verify-production-aab.yml', import.meta.url), 'utf8');
    const installStart = workflow.indexOf('      - name: Install locked app dependencies for Expo config\n');
    const nextStepStart = workflow.indexOf('\n      - name:', installStart + 1);
    const fetchStart = workflow.indexOf('      - name: Fetch only the approved finished EAS AAB');
    assert.ok(installStart >= 0 && nextStepStart > installStart && fetchStart > nextStepStart);
    const install = workflow.slice(installStart, nextStepStart);
    assert.match(install, /^        run: yarn install --frozen-lockfile --non-interactive$/m);
    assert.doesNotMatch(install, /^        working-directory:/m);
});

test('waits for stable root, boot and Android services after adbd restarts', () => {
    const directory = mkdtempSync(join(tmpdir(), 'yify-emulator-ready-'));
    try {
        const adb = join(directory, 'adb');
        const sleep = join(directory, 'sleep');
        const count = join(directory, 'count');
        const calls = join(directory, 'calls');
        writeFileSync(adb, `#!/usr/bin/env bash
set -euo pipefail
printf '%s\\n' "$*" >> "$CALLS_FILE"
case "$*" in
  root|wait-for-device) exit 0 ;;
  'shell id -u')
    n=0
    if [ -f "$COUNT_FILE" ]; then n=$(cat "$COUNT_FILE"); fi
    n=$((n + 1))
    printf '%s' "$n" > "$COUNT_FILE"
    if [ "$MODE" = restart ] && [ "$n" -eq 1 ]; then exit 1; fi
    printf '0\\n'
    ;;
  'shell getprop sys.boot_completed') printf '1\\n' ;;
  'shell service check '*)
    service="$4"
    if [ "$MODE" = missing-phone ] && [ "$service" = phone ]; then
      printf 'Service phone: not found\\n'
    else
      printf 'Service %s: found\\n' "$service"
    fi
    ;;
  *) exit 2 ;;
esac
`);
        writeFileSync(sleep, '#!/usr/bin/env bash\nexit 0\n');
        chmodSync(adb, 0o700);
        chmodSync(sleep, 0o700);
        const run = (mode, attempts) => {
            writeFileSync(count, '0');
            writeFileSync(calls, '');
            const result = spawnSync('bash', ['scripts/wait-production-aab-emulator-ready.sh'], {
                cwd: new URL('..', import.meta.url), encoding: 'utf8',
                env: {...process.env, PATH: `${directory}:${process.env.PATH}`, MODE: mode,
                    COUNT_FILE: count, CALLS_FILE: calls, YIFY_EMULATOR_READY_ATTEMPTS: String(attempts)},
            });
            return {result, commands: readFileSync(calls, 'utf8').trim().split('\n')};
        };
        const recovered = run('restart', 5);
        assert.equal(recovered.result.status, 0, recovered.result.stderr);
        assert.equal(recovered.commands[0], 'root');
        assert.equal(recovered.commands.filter(command => command === 'shell id -u').length, 4);
        assert.ok(recovered.commands.includes('shell service check activity'));
        const unavailable = run('missing-phone', 2);
        assert.notEqual(unavailable.result.status, 0);
        assert.match(unavailable.result.stderr, /did not reach stable root and Android service readiness/);
        assert.equal(unavailable.commands.filter(command => command === 'shell service check phone').length, 2);
        assert.ok(!unavailable.commands.includes('shell service check activity'));
    } finally {
        rmSync(directory, {recursive: true, force: true});
    }
});

test('requires network isolation before APK install and before success receipt', () => {
    const script = readFileSync(new URL('./test-production-aab-emulator.sh', import.meta.url), 'utf8');
    const ready = script.indexOf('bash scripts/wait-production-aab-emulator-ready.sh');
    const isolation = script.indexOf("adb shell ip6tables -S OUTPUT | tr -d '\\r' | grep -qx -- '-P OUTPUT DROP'");
    const install = script.indexOf('adb install-multiple');
    const finalIsolation = script.lastIndexOf("adb shell ip6tables -S OUTPUT | tr -d '\\r' | grep -qx -- '-P OUTPUT DROP'");
    const receipt = script.indexOf('writeFileSync(`${directory}/yify-verification-receipt.json`');
    assert.ok(ready >= 0 && isolation > ready && install > isolation);
    assert.ok(finalIsolation > install && receipt > finalIsolation);
});

test('accepts only the exact finished production build', () => {
    assert.equal(verifyBuildMetadata(metadata).pathname, '/artifacts/eas/build.aab');
    for (const [field, value] of [['status', 'IN_PROGRESS'], ['buildProfile', 'preview'], ['gitCommitHash', 'wrong'], ['appBuildVersion', '98'], ['updateChannel', {name: 'Staging'}]]) {
        assert.throws(() => verifyBuildMetadata({...metadata, [field]: value}));
    }
    assert.throws(() => verifyBuildMetadata({...metadata, artifacts: {buildUrl: 'https://example.com/build.aab'}}));
    assert.equal(isAllowedDownloadUrl(new URL('https://expo-user-files.s3.amazonaws.com/app.aab')), true);
    assert.equal(isAllowedDownloadUrl(new URL('https://storage.googleapis.com/app.aab')), true);
    assert.equal(isAllowedDownloadUrl(new URL('http://storage.googleapis.com/app.aab')), false);
    assert.equal(isAllowedDownloadUrl(new URL('https://example.com/app.aab')), false);
});

test('checks compiled bundle identity and channel', () => {
    const xml = `<manifest package="${PACKAGE_NAME}" android:versionCode="97" android:versionName="1.8.15"><application><meta-data android:name="expo.modules.updates.EXPO_RUNTIME_VERSION" android:value="@string/expo_runtime_version"/><meta-data android:name="expo.modules.updates.UPDATES_CONFIGURATION_REQUEST_HEADERS_KEY" android:value="{&quot;expo-channel-name&quot;:&quot;Production&quot;}"/></application></manifest>`;
    assert.doesNotThrow(() => verifyBundleManifest(xml, '0x7f120001'));
    assert.doesNotThrow(() => verifyBundleManifest(xml.replace('@string/expo_runtime_version', '@0x7f120001'), '0x7f120001'));
    assert.throws(() => verifyBundleManifest(xml.replace('@string/expo_runtime_version', '@0x7f120002'), '0x7f120001'));
    assert.throws(() => verifyBundleManifest(xml.replace('Production', 'Staging'), '0x7f120001'));
    assert.throws(() => verifyBundleManifest(xml.replace('versionCode="97"', 'versionCode="98"'), '0x7f120001'));
});

test('checks runtime and upload certificate', () => {
    const resources = `Package '${PACKAGE_NAME}':\n0x7f120001 - string/expo_runtime_version\n\t(default) - [STR] "1.8.15"\n\tlocale: "fr" - [STR] "1.8.15"`;
    assert.equal(verifyRuntimeResources(resources), '0x7f120001');
    assert.throws(() => verifyRuntimeResources(resources.replace('fr" - [STR] "1.8.15"', 'fr" - [STR] "1.8.14"')));
    assert.throws(() => verifyRuntimeResources(resources.replace('"1.8.15"', '"1.8.14"')));
    const fingerprint = UPLOAD_CERT_SHA256.match(/../g).join(':');
    assert.doesNotThrow(() => verifyCertificate(`SHA256: ${fingerprint}`));
    assert.throws(() => verifyCertificate(`SHA256: ${fingerprint.replace('EC', '00')}`));
});
