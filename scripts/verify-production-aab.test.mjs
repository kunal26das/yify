import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {test} from 'node:test';
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
