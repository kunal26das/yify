import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {chmodSync, mkdtempSync, readFileSync, rmSync, writeFileSync} from 'node:fs';
import {test} from 'node:test';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {
    isAllowedDownloadUrl, loadCandidate, validateCandidate, verifyAabHash, verifyApkResult,
    verifyBuildMetadata, verifyBundleManifest, verifyCertificate, verifyInstallEvidence, verifyRuntimeResources, verifySourceFiles,
} from './verify-production-aab.mjs';

const candidate = {
    buildId: '5adeee2b-643f-44a2-b2ab-f10a697da949',
    sourceSha: 'f6064f0f0e5322d7b2df137db700b8953eb6c650',
    aabSha256: '5a9cdab10e58faf3ec4083b2f91d2fef8c0a9e4da2b78ad45ac0e5dd0c159ec9',
    projectId: '130cfded-cef0-49b3-94a4-82d3a3852ef5',
    packageName: 'io.github.kunal26das.yify', version: '1.8.16', versionCode: '98', runtime: '1.8.16',
    uploadCertSha256: 'EC97730BA790E825A7F777507AA2E7188F7EF2104CF64F9FCCA8BBFF8902E79F',
};
const metadata = {
    id: candidate.buildId, status: 'FINISHED', platform: 'ANDROID', app: {id: candidate.projectId},
    appIdentifier: candidate.packageName, buildProfile: 'production', appVersion: candidate.version,
    appBuildVersion: candidate.versionCode, runtime: {version: candidate.runtime}, updateChannel: {name: 'Production'}, gitCommitHash: candidate.sourceSha,
    fingerprint: {hash: 'abc'}, artifacts: {buildUrl: 'https://expo.dev/artifacts/eas/build.aab'},
};

test('installs locked app dependencies before querying EAS build metadata', () => {
    const workflow = readFileSync(new URL('../.github/workflows/verify-production-aab.yml', import.meta.url), 'utf8');
    assert.match(workflow, /github\.ref == 'refs\/heads\/main'/);
    assert.match(workflow, /verify-production-aab\.mjs candidate scripts\/android-qa\/production-aab-candidate\.json/);
    assert.doesNotMatch(workflow, /github\.event\.inputs|workflow_dispatch:\s*\n\s*inputs:/);
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
        const timeout = join(directory, 'timeout');
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
        writeFileSync(timeout, '#!/usr/bin/env bash\nshift\nexec "$@"\n');
        chmodSync(adb, 0o700);
        chmodSync(sleep, 0o700);
        chmodSync(timeout, 0o700);
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
    assert.equal(verifyBuildMetadata(metadata, candidate).pathname, '/artifacts/eas/build.aab');
    for (const [field, value] of [['id', 'wrong'], ['status', 'IN_PROGRESS'], ['platform', 'IOS'], ['app', {id: 'wrong'}],
        ['appIdentifier', 'wrong'], ['buildProfile', 'preview'], ['appVersion', '1.8.15'], ['runtime', {version: '1.8.15'}],
        ['gitCommitHash', 'wrong'], ['appBuildVersion', '97'], ['updateChannel', {name: 'Staging'}]]) {
        assert.throws(() => verifyBuildMetadata({...metadata, [field]: value}, candidate), field);
    }
    assert.throws(() => verifyBuildMetadata({...metadata, artifacts: {buildUrl: 'https://example.com/build.aab'}}, candidate));
    assert.equal(isAllowedDownloadUrl(new URL('https://expo-user-files.s3.amazonaws.com/app.aab')), true);
    assert.equal(isAllowedDownloadUrl(new URL('https://storage.googleapis.com/app.aab')), true);
    assert.equal(isAllowedDownloadUrl(new URL('http://storage.googleapis.com/app.aab')), false);
    assert.equal(isAllowedDownloadUrl(new URL('https://example.com/app.aab')), false);
});

test('checks compiled bundle identity and channel', () => {
    const xml = `<manifest package="${candidate.packageName}" android:versionCode="98" android:versionName="1.8.16"><application><meta-data android:name="expo.modules.updates.EXPO_RUNTIME_VERSION" android:value="@string/expo_runtime_version"/><meta-data android:name="expo.modules.updates.UPDATES_CONFIGURATION_REQUEST_HEADERS_KEY" android:value="{&quot;expo-channel-name&quot;:&quot;Production&quot;}"/></application></manifest>`;
    assert.doesNotThrow(() => verifyBundleManifest(xml, '0x7f120001', candidate));
    assert.doesNotThrow(() => verifyBundleManifest(xml.replace('@string/expo_runtime_version', '@0x7f120001'), '0x7f120001', candidate));
    assert.throws(() => verifyBundleManifest(xml.replace('@string/expo_runtime_version', '@0x7f120002'), '0x7f120001', candidate));
    assert.throws(() => verifyBundleManifest(xml.replace('Production', 'Staging'), '0x7f120001', candidate));
    assert.throws(() => verifyBundleManifest(xml.replace('versionCode="98"', 'versionCode="97"'), '0x7f120001', candidate));
    assert.throws(() => verifyBundleManifest(xml.replace(candidate.packageName, 'wrong.package'), '0x7f120001', candidate));
});

test('checks runtime and upload certificate', () => {
    const resources = `Package '${candidate.packageName}':\n0x7f120001 - string/expo_runtime_version\n\t(default) - [STR] "1.8.16"\n\tlocale: "fr" - [STR] "1.8.16"`;
    assert.equal(verifyRuntimeResources(resources, candidate), '0x7f120001');
    assert.throws(() => verifyRuntimeResources(resources.replace('fr" - [STR] "1.8.16"', 'fr" - [STR] "1.8.14"'), candidate));
    assert.throws(() => verifyRuntimeResources(resources.replace(candidate.packageName, 'wrong.package'), candidate));
    const fingerprint = candidate.uploadCertSha256.match(/../g).join(':');
    assert.doesNotThrow(() => verifyCertificate(`SHA256: ${fingerprint}`, candidate));
    assert.throws(() => verifyCertificate(`SHA256: ${fingerprint.replace('EC', '00')}`, candidate));
});

test('requires complete trusted identity and rejects a different AAB hash', () => {
    assert.doesNotThrow(() => validateCandidate(candidate));
    assert.throws(() => validateCandidate({...candidate, unknown: 'yes'}));
    assert.throws(() => validateCandidate({...candidate, aabSha256: null}));
    const directory = mkdtempSync(join(tmpdir(), 'yify-aab-hash-'));
    try {
        const manifest = join(directory, 'candidate.json');
        writeFileSync(manifest, JSON.stringify({...candidate, aabSha256: null}));
        assert.throws(() => loadCandidate(manifest), /Invalid candidate aabSha256/);
        const path = join(directory, 'candidate.aab');
        writeFileSync(path, Buffer.alloc(1024, 7));
        assert.throws(() => verifyAabHash(path, candidate), /AAB SHA256 mismatch/);
        const hash = createHash('sha256').update(Buffer.alloc(1024, 7)).digest('hex');
        assert.equal(verifyAabHash(path, {...candidate, aabSha256: hash}), hash);
    } finally { rmSync(directory, {recursive: true, force: true}); }
});

test('rejects source metadata and APK identity mismatches', () => {
    assert.doesNotThrow(() => verifySourceFiles(candidate));
    assert.throws(() => verifySourceFiles({...candidate, version: '1.8.15'}), /Source version mismatch/);
    assert.throws(() => verifySourceFiles({...candidate, projectId: '00000000-0000-0000-0000-000000000000'}), /Source project mismatch/);
    const apk = {packageName: candidate.packageName, longVersionCode: '98', extractNativeLibs: true,
        artifacts: [{sha256: candidate.aabSha256}]};
    assert.doesNotThrow(() => verifyApkResult(apk, candidate));
    assert.throws(() => verifyApkResult({...apk, packageName: 'wrong.package'}, candidate), /APK package mismatch/);
    assert.throws(() => verifyApkResult({...apk, longVersionCode: '97'}, candidate), /APK version code mismatch/);
    const ephemeralSigner = 'a'.repeat(64);
    const installedPackage = 'versionCode=98 minSdk=24\nversionName=1.8.16';
    assert.equal(verifyInstallEvidence(apk, [candidate.aabSha256], [ephemeralSigner], installedPackage, candidate), ephemeralSigner);
    assert.throws(() => verifyInstallEvidence(apk, ['b'.repeat(64)], [ephemeralSigner], installedPackage, candidate), /Installed APK bytes/);
    assert.throws(() => verifyInstallEvidence(apk, [candidate.aabSha256], [ephemeralSigner], installedPackage.replace('98', '97'), candidate), /Installed version/);
    assert.throws(() => verifyInstallEvidence(apk, [candidate.aabSha256], [candidate.uploadCertSha256], installedPackage, candidate), /Ephemeral APK signer/);
});
