import assert from 'node:assert/strict';
import test from 'node:test';
import type {Channel, LogLine, ReleaseRecord, RunStoreReleaseOptions} from '../entities/index.js';
import type {
    AndroidProductionPublisher,
    Installer,
    ReleaseLedger,
    RuntimeVersions,
    Workspace
} from '../repositories/index.js';
import {createCancellation} from '../../data/process/cancellationRegistry.js';
import {createOperationGuard} from '../services/operationGuard.js';
import {createStoreReleaseUseCases} from './storeRelease.js';
import {createUpdateUseCases} from './update.js';

function fixture(options: {
    productionOk?: boolean;
    alreadyReleased?: boolean;
    installOk?: boolean;
    firebaseOk?: boolean;
    cancelAfterSubmission?: boolean;
    cancelDuringRuntime?: boolean;
} = {}) {
    const cancellation = createCancellation();
    const calls: string[] = [];
    const records: ReleaseRecord[] = [];
    const logs: LogLine[] = [];
    const updateCalls: string[][] = [];
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
            assert.equal(records.some((record) => record.channel === 'Production'), false);
            if (options.cancelAfterSubmission) cancellation.cancelActive();
            return {
                ok: options.productionOk !== false,
                buildId: 'exact-build-id',
                submissionId: 'exact-submission-id',
                buildUrl: 'https://expo.dev/builds/exact-build-id',
                submissionUrl: 'https://expo.dev/submissions/exact-submission-id',
            };
        },
    };
    const runtimeVersions: RuntimeVersions = {
        resolve: async () => {
            if (options.cancelDuringRuntime) cancellation.cancelActive();
            return '1.7.6';
        },
        embeddedChannel: async (channel) => channel ?? 'Production',
    };
    const ledger: ReleaseLedger = {
        list: () => records,
        find: (platform, channel, runtimeVersion) => options.alreadyReleased
            ? {platform, channel, runtimeVersion, version: '1.7.6', releasedAt: '2026-09-09T00:00:00Z'}
            : records.find((record) => record.platform === platform &&
            record.channel === channel && record.runtimeVersion === runtimeVersion) ?? null,
        record: (record) => records.push(record),
        filePath: () => '/mock/releases.json',
    };
    const installer: Installer = {
        installCommand: () => 'mock install',
        cleanInstall: async (_onLine, _label, mode) => {
            calls.push(`install:${mode}`);
            return {ok: options.installOk !== false, code: options.installOk === false ? 1 : 0};
        },
    };
    const operation = createOperationGuard(cancellation);
    const store = createStoreReleaseUseCases({
        workspace,
        cancellation,
        operation,
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
                return {ok: options.firebaseOk !== false};
            },
        },
        runtimeVersions,
        ledger,
        installer,
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
    const updates = createUpdateUseCases({
        workspace, cancellation, operation, runtimeVersions, ledger, installer,
        cli: {
            run: async (args) => {
                updateCalls.push(args);
                return {ok: true, code: 0};
            },
        },
    });
    return {store, run, calls, records, logs, ledger, updates, updateCalls};
}

test('Android Production returns the accepted Expo receipt without recording a release', async () => {
    const {run, calls, records, store} = fixture();
    const result = await run();
    assert.equal(result.ok, true);
    assert.deepEqual(calls, ['install:frozen', 'expo:1.7.6:1.7.6']);
    assert.deepEqual(result.steps, [{
        platform: 'android', channel: 'Production', ok: true, queued: true,
        buildId: 'exact-build-id', submissionId: 'exact-submission-id',
        buildUrl: 'https://expo.dev/builds/exact-build-id',
        submissionUrl: 'https://expo.dev/submissions/exact-submission-id',
    }]);
    assert.deepEqual(records, []);
    assert.equal((await store.releaseCoverage(['android'], ['Production'])).covered, false);
});

test('queued Production stays blocked for OTA until the confirmed release is recorded', async () => {
    const {run, updates, updateCalls, ledger} = fixture();
    await run();
    assert.equal(await updates.canPublish('android', 'Production'), false);
    const blocked = await updates.runUpdate(['android'], ['Production'], 'fix', () => {
    });
    assert.deepEqual(blocked.steps, [{
        platform: 'android', channel: 'Production', ok: false, blocked: true,
    }]);
    assert.deepEqual(updateCalls, []);
    ledger.record({
        platform: 'android', channel: 'Production', version: '1.7.6',
        runtimeVersion: '1.7.6', releasedAt: '2026-09-11T00:00:00Z',
    });
    assert.equal(await updates.canPublish('android', 'Production'), true);
    assert.equal((await updates.runUpdate(['android'], ['Production'], 'fix', () => {
    })).ok, true);
    assert.equal(updateCalls.length, 1);
});

test('an Expo failure does not record a release or fall back to direct Play publishing', async () => {
    const {run, records, calls} = fixture({productionOk: false});
    const result = await run();
    assert.equal(result.ok, false);
    assert.equal(result.steps[0].queued, undefined);
    assert.equal(records.length, 0);
    assert.deepEqual(calls, ['install:frozen', 'expo:1.7.6:1.7.6']);
});

test('cancellation after remote acceptance preserves the queued receipt without recording a release', async () => {
    const {run, records} = fixture({cancelAfterSubmission: true});
    const result = await run();
    assert.equal(result.ok, false);
    assert.equal(result.steps[0].queued, true);
    assert.equal(result.steps[0].submissionId, 'exact-submission-id');
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
    const result = await run({channels: ['Staging', 'Production']});
    assert.equal(result.ok, true);
    assert.deepEqual(calls, [
        'install:frozen', 'local:Staging', 'firebase', '/built.apk', 'expo:1.7.6:1.7.6',
    ]);
    assert.deepEqual(records.map((record) => record.channel), ['Staging']);
    assert.equal(result.steps[0].queued, undefined);
    assert.equal(result.steps[1].queued, true);
});

test('a failed Staging upload does not hide an accepted Production request', async () => {
    const {run, records} = fixture({firebaseOk: false});
    const result = await run({channels: ['Staging', 'Production']});
    assert.equal(result.ok, false);
    assert.equal(result.steps[0].ok, false);
    assert.equal(result.steps[1].ok, true);
    assert.equal(result.steps[1].queued, true);
    assert.equal(result.steps[1].buildId, 'exact-build-id');
    assert.deepEqual(records, []);
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
    assert.equal(result.steps[0].queued, undefined);
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
