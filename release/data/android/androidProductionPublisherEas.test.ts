import assert from 'node:assert/strict';
import childProcess from 'node:child_process';
import {EventEmitter} from 'node:events';
import fs from 'node:fs';
import {syncBuiltinESMExports} from 'node:module';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import type {LogLine, ReleaseCli, RunOptions, Workspace} from '../../domain/index.js';
import {createCancellation} from '../process/cancellationRegistry.js';
import {createAndroidProductionPublisher} from './androidProductionPublisherEas.js';

const PROJECT_ID = '130cfded-cef0-49b3-94a4-82d3a3852ef5';
const BUILD_ID = 'ad48b005-9201-4c1c-a943-569ca3ed962c';
const SUBMISSION_ID = 'cab2740c-fc9a-4e92-8f3c-5b997c794f73';
const PROJECT_URL = 'https://expo.dev/accounts/kunal26das/projects/yify';
type TestContext = Parameters<NonNullable<Parameters<typeof test>[0]>>[0];
const expectedSubmission = {
    id: SUBMISSION_ID, status: 'AWAITING_BUILD', platform: 'ANDROID', app: {id: PROJECT_ID},
    androidConfig: {track: 'production', releaseStatus: 'COMPLETED'},
};
const expectedBuild = {
    id: BUILD_ID, status: 'IN_QUEUE', platform: 'ANDROID', distribution: 'STORE',
    buildProfile: 'production', channel: 'Production', appVersion: '1.7.5',
    appBuildVersion: '77', runtimeVersion: '1.7.5',
    project: {id: PROJECT_ID, slug: 'yify', ownerAccount: {name: 'kunal26das'}},
    submissions: [expectedSubmission],
};

function fixture(t: TestContext, options: {
    build?: Record<string, unknown>;
    output?: string;
    credentialsFail?: boolean;
    buildFail?: boolean;
    cancelAt?: 'credentials' | 'build';
} = {}) {
    const repoRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'yify-eas-publisher-'));
    const cancellation = createCancellation();
    const write = (name: string, value: string) => {
        const file = path.join(repoRoot, name);
        fs.mkdirSync(path.dirname(file), {recursive: true});
        fs.writeFileSync(file, value);
    };
    const read = (name: string) => fs.readFileSync(path.join(repoRoot, name), 'utf8');
    write('package.json', JSON.stringify({version: '1.7.5', versionCode: 77}));
    write('app.json', JSON.stringify({expo: {extra: {eas: {projectId: PROJECT_ID}}}}));
    write('play-key.json', '{}');
    write('eas.json', JSON.stringify({
        cli: {appVersionSource: 'local'},
        build: {
            base: {environment: 'production', env: {EXPO_UPDATE_CHANNEL: 'Production'}, autoIncrement: false},
            production: {extends: 'base', android: {credentialsSource: 'local', buildType: 'app-bundle'}},
        },
        submit: {
            production: {android: {track: 'internal', releaseStatus: 'draft', serviceAccountKeyPath: 'play-key.json'}},
            'play-production': {extends: 'production', android: {track: 'production', releaseStatus: 'completed'}},
        },
    }));
    write('android/app/build.gradle', '// user customization\nandroid {\n  defaultConfig {\n    versionCode 76\n    versionName "1.7.4"\n  }\n}\n');
    write('android/app/src/main/res/values/strings.xml', '<resources>\n  <string name="expo_runtime_version">1.7.4</string>\n  <string name="custom">Keep me</string>\n</resources>');
    write('android/app/src/main/AndroidManifest.xml', `<manifest><application>
  <meta-data android:name="expo.modules.updates.UPDATES_CONFIGURATION_REQUEST_HEADERS_KEY" android:value="{&quot;expo-channel-name&quot;:&quot;Staging&quot;,&quot;custom&quot;:&quot;retained&quot;}"/>
  <meta-data android:name="expo.modules.updates.EXPO_RUNTIME_VERSION" android:value="@string/expo_runtime_version"/>
  <meta-data android:name="expo.modules.updates.EXPO_UPDATE_URL" android:value="https://u.expo.dev/${PROJECT_ID}"/>
  <meta-data android:name="custom" android:value="Keep me"/>
</application></manifest>`);
    const workspace: Workspace = {
        repoRoot,
        apps: {android: {name: 'Yify', platform: 'android'}, ios: {name: 'Yify', platform: 'ios'}},
        channels: ['Production', 'Staging'], channelName: (channel) => channel, currentBranch: () => 'main',
    };
    const processes: string[][] = [];
    const calls: Array<{args: string[]; opts?: RunOptions}> = [];
    const lines: LogLine[] = [];
    t.mock.method(childProcess, 'spawn', ((command: string, args: string[], config: childProcess.SpawnOptions) => {
        processes.push([command, ...args]);
        assert.equal(config.cwd, repoRoot);
        const child = Object.assign(new EventEmitter(), {stdout: null, stderr: null, kill: () => true});
        queueMicrotask(() => {
            if (options.cancelAt === 'credentials') cancellation.cancelActive();
            child.emit('close', options.credentialsFail ? 1 : 0);
        });
        return child as childProcess.ChildProcess;
    }) as typeof childProcess.spawn);
    syncBuiltinESMExports();
    const cli: ReleaseCli = {
        async run(args, onLine, opts) {
            calls.push({args, opts});
            if (args[0] === 'build') {
                const output = options.output ?? JSON.stringify([{...expectedBuild, ...options.build}], null, 2);
                for (const text of output.split('\n')) onLine({stream: 'stdout', text});
                if (options.cancelAt === 'build') cancellation.cancelActive();
                return {ok: !options.buildFail, code: options.buildFail ? 1 : 0};
            }
            assert.fail('The handoff must not poll or create a separate submission.');
        },
    };
    const publisher = createAndroidProductionPublisher({workspace, cancellation, cli});
    t.after(() => {
        t.mock.restoreAll();
        syncBuiltinESMExports();
        fs.rmSync(repoRoot, {recursive: true, force: true});
    });
    const release = (version = '1.7.5') => publisher.release(version, '1.7.5', (line) => {
        lines.push(line);
    }, 'Android Production');
    return {release, processes, calls, cancellation, lines, write, read};
}

test('synchronizes native release fields and returns when the build and automatic Play upload are queued', async (t) => {
    const f = fixture(t);
    assert.deepEqual(await f.release(), {
        ok: true, buildId: BUILD_ID, submissionId: SUBMISSION_ID,
        buildUrl: `${PROJECT_URL}/builds/${BUILD_ID}`,
        submissionUrl: `${PROJECT_URL}/submissions/${SUBMISSION_ID}`,
    });
    assert.deepEqual(f.processes, [['bash', 'scripts/setup-eas-credentials.sh']]);
    assert.deepEqual(f.calls.map(({args}) => args), [
        ['build', '--platform', 'android', '--profile', 'production', '--auto-submit-with-profile', 'play-production', '--non-interactive', '--no-wait', '--json'],
    ]);
    for (const call of f.calls) assert.deepEqual(call.opts, {label: 'Android Production', retries: 0, idleTimeoutMs: 0});
    const gradle = f.read('android/app/build.gradle');
    assert.match(gradle, /versionCode 77/);
    assert.match(gradle, /versionName "1\.7\.5"/);
    assert.match(gradle, /\/\/ user customization/);
    const strings = f.read('android/app/src/main/res/values/strings.xml');
    assert.match(strings, /expo_runtime_version">1\.7\.5</);
    assert.match(strings, /name="custom">Keep me</);
    const manifest = f.read('android/app/src/main/AndroidManifest.xml');
    assert.match(manifest, /&quot;Production&quot;/);
    assert.match(manifest, /&quot;custom&quot;:&quot;retained&quot;/);
    assert.match(manifest, /android:name="custom" android:value="Keep me"/);
    assert.equal(f.lines.some((line) => line.stream === 'stdout'), false, 'raw build JSON is not forwarded to the UI');
    assert.ok(f.lines.some((line) => line.text.includes(`${PROJECT_URL}/builds/${BUILD_ID}`) && line.text.includes(`${PROJECT_URL}/submissions/${SUBMISSION_ID}`)));
});

test('replaces legacy Gradle package expressions with literal versions EAS can inspect', async (t) => {
    const f = fixture(t);
    f.write('android/app/build.gradle', 'versionCode packageJson.versionCode\nversionName packageJson.version\n');
    assert.equal((await f.release()).ok, true);
    assert.equal(f.read('android/app/build.gradle'), 'versionCode 77\nversionName "1.7.5"\n');
});

test('unknown native shapes are rejected before any partial file synchronization or cloud operation', async (t) => {
    const f = fixture(t);
    const before = f.read('android/app/build.gradle');
    f.write('android/app/src/main/AndroidManifest.xml', '<manifest/>');
    assert.equal((await f.release()).ok, false);
    assert.equal(f.read('android/app/build.gradle'), before);
    assert.equal(f.processes.length, 0);
    assert.equal(f.calls.length, 0);
});

test('rejects a stale requested version before altering native sources', async (t) => {
    const f = fixture(t);
    const before = f.read('android/app/build.gradle');
    assert.equal((await f.release('1.7.4')).ok, false);
    assert.equal(f.read('android/app/build.gradle'), before);
    assert.equal(f.processes.length, 0);
});

for (const [name, mutate] of [
    ['remote credentials', (config: any) => { config.build.production.android.credentialsSource = 'remote'; }],
    ['APK build', (config: any) => { config.build.production.android.buildType = 'apk'; }],
    ['preview environment', (config: any) => { config.build.base.environment = 'preview'; }],
    ['Staging channel', (config: any) => { config.build.base.env.EXPO_UPDATE_CHANNEL = 'Staging'; }],
    ['platform channel override', (config: any) => { config.build.production.android.env = {EXPO_UPDATE_CHANNEL: 'Staging'}; }],
    ['automatic version increment', (config: any) => { config.build.base.autoIncrement = true; }],
    ['remote versions', (config: any) => { config.cli.appVersionSource = 'remote'; }],
    ['internal track', (config: any) => { config.submit['play-production'].android.track = 'internal'; }],
    ['draft submission', (config: any) => { config.submit['play-production'].android.releaseStatus = 'draft'; }],
    ['missing Play key', (config: any) => { config.submit.production.android.serviceAccountKeyPath = 'absent.json'; }],
] as const) {
    test(`profile preflight rejects ${name} before native changes or cloud creation`, async (t) => {
        const f = fixture(t);
        const before = f.read('android/app/build.gradle');
        const config = JSON.parse(f.read('eas.json'));
        mutate(config);
        f.write('eas.json', JSON.stringify(config));
        assert.equal((await f.release()).ok, false);
        assert.equal(f.calls.length, 0);
        assert.equal(f.processes.length, 0);
        assert.equal(f.read('android/app/build.gradle'), before);
    });
}

test('preflight resolves the inherited Play key environment expression like EAS', async (t) => {
    const f = fixture(t);
    const config = JSON.parse(f.read('eas.json'));
    config.submit.production.android.serviceAccountKeyPath = '${YIFY_TEST_KEY_NOT_SET:-play-key.json}';
    f.write('eas.json', JSON.stringify(config));
    assert.equal((await f.release()).ok, true);
});

for (const status of ['NEW', 'IN_QUEUE', 'IN_PROGRESS', 'FINISHED']) {
    test(`accepts a scheduled release while its build is ${status}`, async (t) => {
        const f = fixture(t, {build: {status}});
        assert.equal((await f.release()).ok, true);
        assert.equal(f.calls.length, 1);
    });
}

for (const status of ['AWAITING_BUILD', 'IN_QUEUE', 'IN_PROGRESS', 'FINISHED']) {
    test(`accepts a scheduled Play upload while it is ${status}`, async (t) => {
        const f = fixture(t, {build: {submissions: [{...expectedSubmission, status}]}});
        assert.equal((await f.release()).ok, true);
        assert.equal(f.calls.length, 1);
    });
}

for (const [name, value] of [
    ['status', 'CANCELED'], ['status', 'PENDING_CANCEL'], ['status', 'ERRORED'], ['status', 'UNKNOWN'], ['platform', 'IOS'],
    ['distribution', 'INTERNAL'], ['buildProfile', 'preview'], ['channel', 'Staging'],
    ['appVersion', '1.7.4'], ['appBuildVersion', '76'], ['runtimeVersion', '1.7.4'],
    ['appBuildVersion', ['77']],
    ['id', 'invalid-id'], ['project', {id: 'another-project'}],
] as const) {
    test(`does not confirm a build with mismatched ${name}: ${JSON.stringify(value)}`, async (t) => {
        const f = fixture(t, {build: {[name]: value}});
        assert.equal((await f.release()).ok, false);
        assert.equal(f.calls.length, 1);
        assert.ok(f.lines.some((line) => /Remote work may already exist/.test(line.text)));
    });
}

for (const submissions of [
    undefined, null, [], [expectedSubmission, expectedSubmission], [null],
    ...[
        {id: 'invalid'}, {status: 'ERRORED'}, {status: 'CANCELED'}, {status: 'UNKNOWN'},
        {platform: 'IOS'}, {app: {id: 'another-project'}},
        {androidConfig: {track: 'internal', releaseStatus: 'COMPLETED'}},
        {androidConfig: {track: 'production', releaseStatus: 'DRAFT'}},
    ].map((changes) => [{...expectedSubmission, ...changes}]),
]) {
    test(`does not confirm missing, failed or mismatched automatic submission: ${JSON.stringify(submissions)}`, async (t) => {
        const f = fixture(t, {build: {submissions}});
        assert.equal((await f.release()).ok, false);
        assert.equal(f.calls.length, 1);
    });
}

for (const output of ['not JSON', '[]', JSON.stringify([expectedBuild, expectedBuild])]) {
    test(`rejects ambiguous or malformed EAS output: ${output.slice(0, 30)}`, async (t) => {
        const f = fixture(t, {output});
        assert.equal((await f.release()).ok, false);
        assert.equal(f.calls.length, 1);
    });
}

test('failed credential validation prevents creating any cloud build', async (t) => {
    const f = fixture(t, {credentialsFail: true});
    assert.equal((await f.release()).ok, false);
    assert.equal(f.calls.length, 0);
});

test('a failed handoff is never retried even with a valid receipt', async (t) => {
    const f = fixture(t, {buildFail: true});
    assert.equal((await f.release()).ok, false);
    assert.equal(f.calls.length, 1);
    assert.ok(f.lines.some((line) => /Remote work may already exist/.test(line.text)));
});

test('cancellation before release leaves native sources and external processes untouched', async (t) => {
    const f = fixture(t);
    const before = f.read('android/app/build.gradle');
    f.cancellation.cancelActive();
    assert.equal((await f.release()).ok, false);
    assert.equal(f.read('android/app/build.gradle'), before);
    assert.equal(f.processes.length, 0);
    assert.equal(f.calls.length, 0);
});

for (const cancelAt of ['credentials', 'build'] as const) {
    test(`cancellation during ${cancelAt} does not start a later cloud mutation`, async (t) => {
        const f = fixture(t, {cancelAt});
        assert.equal((await f.release()).ok, false);
        assert.equal(f.calls.length, cancelAt === 'credentials' ? 0 : 1);
        if (cancelAt !== 'credentials') assert.ok(f.lines.some((line) => /Remote EAS build or submission work may continue/.test(line.text)));
    });
}
