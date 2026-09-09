import assert from 'node:assert/strict';
import test from 'node:test';
import type {Channel, LogLine, ReleaseRecord} from '../entities/index.js';
import type {RuntimeVersions, Workspace} from '../repositories/index.js';
import {createCancellation} from '../../data/process/cancellationRegistry.js';
import {createOperationGuard} from '../services/operationGuard.js';
import {createUpdateUseCases} from './update.js';

function fixture(options: {
    embeddedChannel?: RuntimeVersions['embeddedChannel'];
    hasRelease?: boolean;
} = {}) {
    const cancellation = createCancellation();
    const channelChecks: Array<string | undefined> = [];
    const published: string[][] = [];
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
    const updates = createUpdateUseCases({
        workspace,
        cancellation,
        operation: createOperationGuard(cancellation),
        runtimeVersions: {
            resolve: async () => '1.7.4',
            embeddedChannel: async (channel) => {
                channelChecks.push(channel);
                return options.embeddedChannel
                    ? options.embeddedChannel(channel)
                    : channel ?? 'Production';
            },
        },
        ledger: {
            list: () => [],
            find: (platform, channel, runtimeVersion): ReleaseRecord | null =>
                options.hasRelease === false ? null : {
                    platform, channel, runtimeVersion,
                    version: '1.7.4', releasedAt: '2026-09-09T00:00:00.000Z',
                },
            record: () => {},
            filePath: () => '/mock/releases.json',
        },
        installer: {
            installCommand: () => 'mock install',
            cleanInstall: async () => ({ok: true, code: 0}),
        },
        cli: {
            run: async (args) => {
                published.push(args);
                return {ok: true, code: 0};
            },
        },
    });
    return {updates, channelChecks, published, logs};
}

test('publishes both channels using their own config and caches checks per channel', async () => {
    const {updates, channelChecks, published, logs} = fixture();
    const channels: Channel[] = ['Staging', 'Production'];
    const result = await updates.runUpdate(
        ['android', 'ios'], channels, 'test update', (line) => logs.push(line),
    );

    assert.equal(result.ok, true);
    assert.equal(result.steps.length, 4);
    assert.deepEqual(channelChecks, channels);
    assert.deepEqual(published.map((args) => args[args.indexOf('--channel') + 1]), [
        'Staging', 'Staging', 'Production', 'Production',
    ]);
});

test('blocks a target whose channel-specific config still points elsewhere', async () => {
    const {updates, published} = fixture({embeddedChannel: async () => 'Production'});
    const result = await updates.runUpdate(['android'], ['Staging'], 'test update', () => {});

    assert.equal(result.ok, false);
    assert.deepEqual(result.steps, [{
        platform: 'android', channel: 'Staging', ok: false, blocked: true,
    }]);
    assert.equal(published.length, 0);
});

test('still requires a recorded release for the selected runtime and channel', async () => {
    const {updates, published} = fixture({hasRelease: false});
    const result = await updates.runUpdate(['android'], ['Staging'], 'test update', () => {});

    assert.equal(result.ok, false);
    assert.equal(result.steps[0]?.blocked, true);
    assert.equal(published.length, 0);
});
