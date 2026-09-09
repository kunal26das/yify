import assert from 'node:assert/strict';
import childProcess from 'node:child_process';
import crypto from 'node:crypto';
import {EventEmitter} from 'node:events';
import fs from 'node:fs';
import type {ClientRequest, IncomingMessage} from 'node:http';
import https from 'node:https';
import {syncBuiltinESMExports} from 'node:module';
import os from 'node:os';
import path from 'node:path';
import {Readable, Writable} from 'node:stream';
import test from 'node:test';
import type {Workspace} from '../../domain/index.js';
import {createCancellation} from '../process/cancellationRegistry.js';
import {createAndroidPublisher} from './androidPublisherShell.js';

type TestContext = Parameters<NonNullable<Parameters<typeof test>[0]>>[0];

function fixture(t: TestContext) {
    const repoRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'yify-release-test-'));
    const cancellation = createCancellation();
    const workspace: Workspace = {
        repoRoot,
        apps: {
            android: {name: 'Yify', platform: 'android'},
            ios: {name: 'Yify', platform: 'ios'},
        },
        channels: ['Staging', 'Production'],
        channelName: (channel) => channel,
        currentBranch: () => 'main',
    };
    const write = (relative: string, contents: string) => {
        const destination = path.join(repoRoot, relative);
        fs.mkdirSync(path.dirname(destination), {recursive: true});
        fs.writeFileSync(destination, contents);
    };
    write('package.json', JSON.stringify({version: '1.7.4'}));
    write('app.json', JSON.stringify({expo: {android: {package: 'example.app'}}}));
    t.after(() => {
        t.mock.restoreAll();
        syncBuiltinESMExports();
        fs.rmSync(repoRoot, {recursive: true, force: true});
    });
    return {
        repoRoot, cancellation, write,
        publisher: createAndroidPublisher({workspace, cancellation}),
    };
}

function nativeConfig(write: (file: string, contents: string) => void, channel: string) {
    write('android/app/src/main/res/values/strings.xml',
        '<resources><string name="expo_runtime_version">1.7.4</string></resources>');
    write('android/app/src/main/AndroidManifest.xml',
        `<manifest><application><meta-data android:name="expo.modules.updates.UPDATES_CONFIGURATION_REQUEST_HEADERS_KEY" android:value="{&quot;expo-channel-name&quot;:&quot;${channel}&quot;}"/></application></manifest>`);
}

function mockBuild(t: TestContext, options: {regenerate?: boolean} = {}) {
    const f = fixture(t);
    const prebuildChannels: string[] = [];
    const builtManifests: string[] = [];
    nativeConfig(f.write, 'Production');
    f.write('android/gradlew', 'mock gradle executable');
    f.write('android/keystore.properties', 'mock signing config');
    f.write('android/app/build/outputs/apk/release/app-release.apk', 'mock apk');
    f.write('android/app/build/outputs/bundle/release/app-release.aab', 'mock aab');

    // Simulate regeneration without running an Expo or Gradle command.
    t.mock.method(childProcess, 'spawnSync', ((command: string, args: string[], spawnOptions?: childProcess.SpawnSyncOptions) => {
        if (command === 'npx') {
            assert.deepEqual(args, ['expo', 'prebuild', '--platform', 'android']);
            const channel = spawnOptions?.env?.EXPO_UPDATE_CHANNEL ?? '';
            prebuildChannels.push(channel);
            assert.equal(spawnOptions?.cwd, f.repoRoot);
            if (options.regenerate !== false) nativeConfig(f.write, channel);
            return {status: 0, stdout: '', stderr: ''};
        }
        if (args.includes('-printcert')) return {status: 0, stdout: 'SHA1: AA:BB', stderr: ''};
        if (args.includes('-list')) return {status: 0, stdout: 'SHA1: CC:DD', stderr: ''};
        return {status: 1, stdout: '', stderr: ''};
    }) as typeof childProcess.spawnSync);
    t.mock.method(childProcess, 'spawn', ((_command: string) => {
        builtManifests.push(fs.readFileSync(
            path.join(f.repoRoot, 'android/app/src/main/AndroidManifest.xml'), 'utf8',
        ));
        const child = Object.assign(new EventEmitter(), {stdout: null, stderr: null});
        queueMicrotask(() => child.emit('close', 0));
        return child as childProcess.ChildProcess;
    }) as typeof childProcess.spawn);
    syncBuiltinESMExports();
    return {...f, prebuildChannels, builtManifests};
}

test('regenerates native update headers when switching Staging and Production at the same runtime', async (t) => {
    const f = mockBuild(t);
    assert.equal((await f.publisher.build(() => {}, undefined, 'Staging')).ok, true);
    assert.equal((await f.publisher.build(() => {}, undefined, 'Production')).ok, true);

    assert.deepEqual(f.prebuildChannels, ['Staging', 'Production']);
    assert.match(f.builtManifests[0], /&quot;Staging&quot;/);
    assert.match(f.builtManifests[1], /&quot;Production&quot;/);
});

test('reuses native config when both the runtime and channel already match', async (t) => {
    const f = mockBuild(t);
    assert.equal((await f.publisher.build(() => {}, undefined, 'Production')).ok, true);
    assert.deepEqual(f.prebuildChannels, []);
    assert.equal(f.builtManifests.length, 1);
});

test('refuses to build when prebuild leaves the wrong update channel embedded', async (t) => {
    const f = mockBuild(t, {regenerate: false});
    assert.equal((await f.publisher.build(() => {}, undefined, 'Staging')).ok, false);
    assert.deepEqual(f.prebuildChannels, ['Staging']);
    assert.equal(f.builtManifests.length, 0);
});

const privateKey = crypto.generateKeyPairSync('rsa', {modulusLength: 2048})
    .privateKey.export({type: 'pkcs8', format: 'pem'});

function mockPublish(t: TestContext, cancelAt?: 'upload' | 'track' | 'commit') {
    const f = fixture(t);
    const calls: string[] = [];
    f.write('service-account.json', JSON.stringify({
        client_email: 'mock@example.invalid', private_key: privateKey,
    }));
    f.write('app.aab', 'mock bundle');
    const originalAccountPath = process.env.YIFY_RELEASE_PLAY_SERVICE_ACCOUNT;
    process.env.YIFY_RELEASE_PLAY_SERVICE_ACCOUNT = path.join(f.repoRoot, 'service-account.json');
    t.after(() => {
        if (originalAccountPath === undefined) delete process.env.YIFY_RELEASE_PLAY_SERVICE_ACCOUNT;
        else process.env.YIFY_RELEASE_PLAY_SERVICE_ACCOUNT = originalAccountPath;
    });

    t.mock.method(globalThis, 'fetch', async (input: string | URL | Request) => {
        const url = String(input);
        calls.push(url);
        if (url.endsWith('/token')) return new Response(JSON.stringify({access_token: 'mock-token'}));
        if (url.endsWith('/edits')) return new Response(JSON.stringify({id: 'mock-edit'}));
        if (url.endsWith('/tracks/production')) {
            if (cancelAt === 'track') f.cancellation.cancelActive();
            return new Response('{}');
        }
        if (url.endsWith(':commit')) return new Response('{}');
        throw new Error(`Unexpected request: ${url}`);
    });
    t.mock.method(https, 'request', ((_options: unknown, callback: (response: IncomingMessage) => void) => {
        calls.push('upload');
        const request = new Writable({
            write(_chunk, _encoding, done) { done(); },
            final(done) {
                if (cancelAt === 'upload') f.cancellation.cancelActive();
                const response = Readable.from([JSON.stringify({versionCode: 77})]);
                Object.assign(response, {statusCode: 200});
                callback(response as IncomingMessage);
                done();
            },
        });
        return request as ClientRequest;
    }) as typeof https.request);
    return {
        ...f, calls,
        publish: () => f.publisher.publishProduction(path.join(f.repoRoot, 'app.aab'), (line) => {
            if (cancelAt === 'commit' && line.text === 'Play: committing release…') {
                f.cancellation.cancelActive();
            }
        }),
    };
}

for (const cancelAt of ['upload', 'track', 'commit'] as const) {
    test(`does not commit a Play production release cancelled during ${cancelAt}`, async (t) => {
        const f = mockPublish(t, cancelAt);
        assert.equal((await f.publish()).ok, false);
        assert.equal(f.calls.some((url) => url.endsWith(':commit')), false);
        if (cancelAt === 'upload') {
            assert.equal(f.calls.some((url) => url.endsWith('/tracks/production')), false);
        }
    });
}

test('completes the mocked production publish when no cancellation was requested', async (t) => {
    const f = mockPublish(t);
    assert.deepEqual(await f.publish(), {ok: true, versionCode: 77});
    assert.equal(f.calls.filter((url) => url.endsWith(':commit')).length, 1);
});
