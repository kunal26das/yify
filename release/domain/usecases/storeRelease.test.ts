import assert from 'node:assert/strict';
import test from 'node:test';
import type {Channel, LogLine, ReleaseRecord, RunStoreReleaseOptions} from '../entities/index.js';
import type {AndroidProductionPublisher, Workspace} from '../repositories/index.js';
import {createCancellation} from '../../data/process/cancellationRegistry.js';
import {createOperationGuard} from '../services/operationGuard.js';
import {createStoreReleaseUseCases} from './storeRelease.js';

function fixture(options: {
    productionOk?: boolean;
    alreadyReleased?: boolean;
    installOk?: boolean;
    cancelAfterSubmission?: boolean;
    cancelDuringRuntime?: boolean;
} = {}) {
    const cancellation = createCancellation();
    const calls: string[] = [];
    const records: ReleaseRecord[] = [];
    const logs: LogLine[] = [];
    const workspace: Workspace = {
        repoRoot: '/mock/repo',
        apps: {
            android: {name: 'Yify', platform: 'android'},
            ios: {name: 'Yify', platform: 'ios'},
        },
        channels: ['Staging', 'Production'],
        channelName: (channel) => channel,
        currentBranch: () => 'main',
    };
    const production: AndroidProductionPublisher = {
        release: async (version, runtime) => {
            calls.push(`expo:${version}:${runtime}`);
            assert.equal(records.length, calls.includes('firebase') ? 1 : 0);
            if (options.cancelAfterSubmission) cancellation.cancelActive();
            return {ok: options.productionOk !== false, buildId: 'exact-build-id'};
        },
    };
    const store = createStoreReleaseUseCases({
        workspace,
        cancellation,
        operation: createOperationGuard(cancellation),
        androidProductionPublisher: production,
        androidPublisher: {
            build: async (_onLine, _label, channel) => {
                calls.push(`local:${channel}`);
                return {ok: true, artifacts: {apkPath: '/built.apk', aabPath: '/built.aab'}};
            },
            publishProduction: async () => {
                assert.fail('The release console must not use the direct Play publisher.');
            },
            distributeToFirebase: async (apk) => {
                calls.push('firebase', apk);
                return {ok: true};
            },
        },
        runtimeVersions: {
            resolve: async () => {
                if (options.cancelDuringRuntime) cancellation.cancelActive();
                return '1.7.6';
            },
            embeddedChannel: async (channel) => channel ?? 'Production',
        },
        ledger: {
            list: () => records,
            find: (platform, channel, runtimeVersion) => options.alreadyReleased
                ? {platform, channel, runtimeVersion, version: '1.7.6', releasedAt: '2026-09-09T00:00:00Z'}
                : null,
            record: (record) => records.push(record),
            filePath: () => '/mock/releases.json',
        },
        installer: {
            installCommand: () => 'mock install',
            cleanInstall: async (_onLine, _label, mode) => {
                calls.push(`install:${mode}`);
                return {ok: options.installOk !== false, code: options.installOk === false ? 1 : 0};
            },
        },
        binary: {
            exists: () => true,
            repoPackageVersion: () => '1.7.6',
            repoTargetVersion: () => '1.7.6',
            versionFromBinary: async () => '1.7.6',
        },
    });
    const run = (changes: Partial<RunStoreReleaseOptions> = {}) => store.runStoreRelease({
        apkPath: '', ipaPath: '', version: '1.7.6',
        platforms: ['android'], channels: ['Production'], ...changes,
    }, (line) => logs.push(line));
    return {store, run, calls, records, logs};
}

test('Android Production uses Expo and records only a successful submission', async () => {
    const {run, calls, records} = fixture();
    const result = await run();
    assert.equal(result.ok, true);
    assert.deepEqual(calls, ['install:frozen', 'expo:1.7.6:1.7.6']);
    assert.equal(records.length, 1);
    assert.equal(records[0].channel, 'Production');
    assert.equal(records[0].runtimeVersion, '1.7.6');
});

test('an Expo failure does not record a release or fall back to direct Play publishing', async () => {
    const {run, records, calls} = fixture({productionOk: false});
    assert.equal((await run()).ok, false);
    assert.equal(records.length, 0);
    assert.deepEqual(calls, ['install:frozen', 'expo:1.7.6:1.7.6']);
});

test('cancellation during submission does not record a release', async () => {
    const {run, records} = fixture({cancelAfterSubmission: true});
    assert.equal((await run()).ok, false);
    assert.equal(records.length, 0);
});

test('cancellation during runtime resolution prevents any publishing', async () => {
    const {run, records, calls} = fixture({cancelDuringRuntime: true});
    assert.equal((await run()).ok, false);
    assert.deepEqual(calls, ['install:frozen']);
    assert.equal(records.length, 0);
});

test('combined Staging and Production retain independent release paths', async () => {
    const {run, calls, records} = fixture();
    assert.equal((await run({channels: ['Staging', 'Production']})).ok, true);
    assert.deepEqual(calls, [
        'install:frozen', 'local:Staging', 'firebase', '/built.apk', 'expo:1.7.6:1.7.6',
    ]);
    assert.deepEqual(records.map((record) => record.channel), ['Staging', 'Production']);
});

test('a supplied Staging APK still goes directly to Firebase', async () => {
    const {run, calls} = fixture();
    assert.equal((await run({channels: ['Staging'], apkPath: '/supplied.apk'})).ok, true);
    assert.deepEqual(calls, ['install:frozen', 'firebase', '/supplied.apk']);
});

test('supplied APKs are rejected before work starts when Production is selected', async () => {
    for (const channels of [['Production'], ['Staging', 'Production']] as Channel[][]) {
        const {store, run, calls} = fixture();
        const validation = await store.validateBinaries('/supplied.apk', '', ['android'], channels);
        assert.equal(validation.ok, false);
        assert.equal((await run({channels, apkPath: '/supplied.apk'})).ok, false);
        assert.deepEqual(calls, []);
    }
});

test('a stale version from the UI is rejected before installation or cloud building', async () => {
    const {run, calls, records} = fixture();
    assert.equal((await run({version: '1.7.5'})).ok, false);
    assert.deepEqual(calls, []);
    assert.deepEqual(records, []);
});

test('already-recorded runtime skips cloud build and submission', async () => {
    const {run, calls, records} = fixture({alreadyReleased: true});
    const result = await run();
    assert.equal(result.ok, true);
    assert.equal(result.steps[0].skipped, true);
    assert.deepEqual(calls, ['install:frozen']);
    assert.deepEqual(records, []);
});

test('failed dependency installation prevents cloud building', async () => {
    const {run, calls, records} = fixture({installOk: false});
    assert.equal((await run()).ok, false);
    assert.deepEqual(calls, ['install:frozen']);
    assert.deepEqual(records, []);
});

test('iOS remains a record-only flow', async () => {
    const {run, calls, records} = fixture();
    assert.equal((await run({platforms: ['ios'], ipaPath: '/app.ipa'})).ok, true);
    assert.deepEqual(calls, ['install:frozen']);
    assert.equal(records[0].platform, 'ios');
});
