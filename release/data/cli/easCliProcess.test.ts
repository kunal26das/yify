import assert from 'node:assert/strict';
import childProcess from 'node:child_process';
import {EventEmitter} from 'node:events';
import {syncBuiltinESMExports} from 'node:module';
import {PassThrough} from 'node:stream';
import test from 'node:test';
import type {Workspace} from '../../domain/index.js';
import {createCancellation} from '../process/cancellationRegistry.js';
import {createReleaseCli} from './easCliProcess.js';

type TestContext = Parameters<NonNullable<Parameters<typeof test>[0]>>[0];

function fixture(t: TestContext) {
    const cancellation = createCancellation();
    const children: Array<EventEmitter & {stdout: PassThrough; stderr: PassThrough; kill: (signal?: NodeJS.Signals) => boolean}> = [];
    const spawnedArgs: string[][] = [];
    const killSignals: Array<NodeJS.Signals | undefined> = [];
    const timeouts: Array<{callback: () => void; milliseconds: number | undefined}> = [];
    const originalSetTimeout = globalThis.setTimeout;
    t.mock.method(globalThis, 'setTimeout', ((callback: () => void, milliseconds: number) => {
        timeouts.push({callback, milliseconds});
        return originalSetTimeout(callback, milliseconds);
    }) as typeof setTimeout);
    t.mock.method(childProcess, 'spawn', ((_command: string, _args: string[], options: childProcess.SpawnOptions) => {
        spawnedArgs.push(_args);
        assert.equal(options.env?.EXPO_TOKEN, 'configured-session-token');
        const child = Object.assign(new EventEmitter(), {
            stdout: new PassThrough(), stderr: new PassThrough(),
            kill(signal?: NodeJS.Signals) { killSignals.push(signal); child.emit('close', null); return true; },
        });
        children.push(child);
        return child as unknown as childProcess.ChildProcess;
    }) as typeof childProcess.spawn);
    syncBuiltinESMExports();
    const workspace: Workspace = {
        repoRoot: process.cwd(),
        apps: {android: {name: 'Yify', platform: 'android'}, ios: {name: 'Yify', platform: 'ios'}},
        channels: ['Production'], channelName: (channel) => channel, currentBranch: () => 'main',
    };
    const cli = createReleaseCli({workspace, cancellation, sessionStore: {
        read: () => ({token: 'configured-session-token'}), save() {}, clear() {}, configFilePath: () => '/unused',
    }});
    t.after(() => { t.mock.restoreAll(); syncBuiltinESMExports(); });
    return {cli, cancellation, children, timeouts, spawnedArgs, killSignals};
}

test('cloud waits disable the inactivity timer and retain the configured Expo session', async (t) => {
    const f = fixture(t);
    const running = f.cli.run(['build', '--wait'], () => {}, {idleTimeoutMs: 0, retries: 0});
    assert.equal(f.timeouts.length, 0);
    f.children[0].stderr.write('Waiting in free tier queue\n');
    assert.equal(f.timeouts.length, 0);
    f.children[0].emit('close', 0);
    assert.deepEqual(await running, {ok: true, code: 0});
});

test('ordinary CLI operations keep the existing ten-minute inactivity watchdog', async (t) => {
    const f = fixture(t);
    const running = f.cli.run(['update'], () => {}, {retries: 0});
    assert.equal(f.timeouts[0].milliseconds, 10 * 60 * 1000);
    f.timeouts[0].callback();
    assert.equal((await running).ok, false);
    assert.deepEqual(f.killSignals, ['SIGTERM']);
});

test('OTA uses the upload wrapper and graceful cancellation so it can stop the publishing child', async (t) => {
    const f = fixture(t);
    const running = f.cli.run(['update', '--json'], () => {}, {retries: 0});
    assert.match(f.spawnedArgs[0][0], /scripts\/eas-with-sentry\.mjs$/);
    assert.deepEqual(f.spawnedArgs[0].slice(2), ['update', '--json']);
    f.cancellation.cancelActive();
    assert.deepEqual(await running, {ok: false, code: 130});
    assert.deepEqual(f.killSignals, ['SIGTERM']);
});

test('explicit retries zero never reruns a mutation after a transient network error', async (t) => {
    const f = fixture(t);
    const running = f.cli.run(['submit', '--wait'], () => {}, {idleTimeoutMs: 0, retries: 0});
    f.children[0].stderr.write('ECONNRESET\n');
    f.children[0].emit('close', 1);
    assert.equal((await running).ok, false);
    assert.equal(f.children.length, 1);
});

test('cancellation prevents default transient-error retries after the child finishes', async (t) => {
    const f = fixture(t);
    const running = f.cli.run(['build'], () => {}, {idleTimeoutMs: 0});
    f.children[0].stderr.write('ETIMEDOUT\n');
    f.cancellation.cancelActive();
    assert.deepEqual(await running, {ok: false, code: 130});
    assert.equal(f.children.length, 1);
    assert.deepEqual(f.killSignals, ['SIGKILL']);
});

test('cancellation while announcing a command prevents spawning the cloud mutation', async (t) => {
    const f = fixture(t);
    const result = await f.cli.run(['build'], () => { f.cancellation.cancelActive(); }, {idleTimeoutMs: 0, retries: 0});
    assert.deepEqual(result, {ok: false, code: 130});
    assert.equal(f.children.length, 0);
});
