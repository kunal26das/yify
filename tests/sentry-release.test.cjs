const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

const modules = Promise.all([import('../scripts/sentry-release.mjs'), import('../scripts/eas-with-sentry.mjs')]);
const commit = 'a'.repeat(40);
const group = '00b14c08-bc45-44aa-aa2e-bef272c6763f';
const plan = {kind: 'ota', releases: {android: 'io.github.kunal26das.yify@1.7.7+79'},
    commit, environment: 'production', runtimeVersion: '1.7.7'};
const update = {id: '00b14c08-bc45-44aa-aa2e-bef272c6763e', group, platform: 'android',
    gitCommitHash: commit, runtimeVersion: '1.7.7', createdAt: '2026-09-01T12:00:00.000Z'};
const receipt = {status: 'succeeded', releases: Object.values(plan.releases), commit, environment: 'production',
    name: `expo-update:${group}`, url: `https://expo.dev/accounts/kunal26das/projects/yify/updates/${group}`,
    dateFinished: '2026-09-01T12:00:00.000Z'};

function fixture(t) {
    const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'yify-sentry-release-'));
    t.after(() => fs.rmSync(cwd, {force: true, recursive: true}));
    const planPath = path.join(cwd, 'plan.json');
    fs.writeFileSync(planPath, JSON.stringify(plan));
    return {cwd, planPath, verifySource: () => {}, env: {SENTRY_AUTH_TOKEN: 'private-test-token', SENTRY_DEPLOYMENT_PLAN: planPath}};
}

function response(data, status = 200, link) {
    return {ok: status >= 200 && status < 300, status, json: async () => data,
        headers: {get: () => link}};
}

test('OTA receipts retain the actual runtime, source commit, group and publication time', async () => {
    const [{completePlan}] = await modules;
    assert.deepEqual(completePlan(plan, [update]), receipt);
    for (const changed of [{gitCommitHash: 'b'.repeat(40)}, {runtimeVersion: '1.7.6'},
        {platform: 'ios'}, {isRollBackToEmbedded: true}, {id: 'missing'}]) {
        assert.throws(() => completePlan(plan, [{...update, ...changed}]), /does not match/);
    }
    assert.throws(() => completePlan({...plan, releases: {...plan.releases, ios: 'app@1.7.7+79'}}, [update]), /missing a planned platform/);
});

test('hosting production receipts require actual promotion and use the immutable deployment identifier', async () => {
    const [{completePlan}] = await modules;
    const hosting = {kind: 'hosting', releases: {web: 'Yify@1.7.7'}, commit, environment: 'production'};
    const publication = {identifier: 'my-deploy', url: 'https://my-deploy.expo.app'};
    assert.throws(() => completePlan(hosting, publication), /does not confirm production/);
    const result = completePlan(hosting, {...publication, production: {url: 'https://yify.expo.app'}}, receipt.dateFinished);
    assert.equal(result.name, 'expo-hosting:my-deploy');
    assert.equal(result.url, 'https://my-deploy.expo.app/');
});

test('release metadata refuses unfinished, ambiguous, secret-bearing or future receipts before HTTP', async (t) => {
    const [{recordDeployment}] = await modules;
    const f = fixture(t);
    for (const changed of [{status: 'running'}, {commit: 'main'}, {releases: []},
        {url: 'https://example.com/deploy?token=private'}, {dateFinished: '2999-01-01T00:00:00Z'}]) {
        await assert.rejects(recordDeployment({...receipt, ...changed}, {...f, fetch: () => assert.fail('HTTP must not run')}));
    }
});

test('first deployment creates and finalizes the exact release with its source commit', async (t) => {
    const [{recordDeployment}] = await modules;
    const f = fixture(t);
    const calls = [];
    const results = [response({}, 404), response({version: receipt.releases[0]}, 201), response({id: '123'}, 201)];
    const output = await recordDeployment(receipt, {...f, fetch: async (url, options) => {
        calls.push({url: String(url), method: options.method, body: options.body && JSON.parse(options.body)});
        assert.equal(options.redirect, 'error');
        return results.shift();
    }});
    assert.equal(output[0].deploymentId, '123');
    assert.equal(calls[1].body.version, receipt.releases[0]);
    assert.equal(calls[1].body.ref, commit);
    assert.deepEqual(calls[1].body.commits, [{id: commit, repository: 'kunal26das/yify'}]);
    assert.equal(calls[1].body.dateReleased, receipt.dateFinished);
    assert.equal(calls[2].body.name, receipt.name);
    assert.equal(calls[2].body.dateFinished, receipt.dateFinished);
});

test('retry after an uncertain deploy response finds the original deployment without writing duplicates', async (t) => {
    const [{recordDeployment}] = await modules;
    const f = fixture(t);
    const results = [response({version: receipt.releases[0]}), response([{id: '123', name: receipt.name,
        environment: receipt.environment, url: receipt.url}])];
    const output = await recordDeployment(receipt, {...f, fetch: async (_url, options) => {
        assert.equal(options.method, 'GET');
        return results.shift();
    }});
    assert.deepEqual(output, [{release: receipt.releases[0], deploymentId: '123', alreadyRecorded: true}]);
});

test('an additional OTA preserves the first release date and existing commit associations', async (t) => {
    const [{recordDeployment}] = await modules;
    const f = fixture(t);
    const oldCommit = 'b'.repeat(40);
    const firstDate = '2026-08-30T12:00:00.000Z';
    const results = [response({dateReleased: firstDate}), response([]), response([{id: oldCommit, repository: {name: 'kunal26das/yify'}}]),
        response({}), response({id: '456'}, 201)];
    const bodies = [];
    await recordDeployment(receipt, {...f, fetch: async (_url, options) => {
        if (options.body) bodies.push(JSON.parse(options.body));
        return results.shift();
    }});
    assert.equal(bodies[0].dateReleased, firstDate);
    assert.deepEqual(bodies[0].commits.map(({id}) => id), [oldCommit, commit]);
});

test('pagination cannot forward the private token to another host', async (t) => {
    const [{recordDeployment}] = await modules;
    const f = fixture(t);
    let count = 0;
    const results = [response({}), response([], 200, '<https://untrusted.example/api/>; rel="next"; results="true"')];
    await assert.rejects(recordDeployment(receipt, {...f, fetch: async () => {
        count += 1;
        return results.shift();
    }}), /outside the release API/);
    assert.equal(count, 2);
});

test('Sentry failures expose status only and direct retries to the saved receipt', async (t) => {
    const [{recordDeployment}] = await modules;
    const f = fixture(t);
    await assert.rejects(recordDeployment(receipt, {...f, fetch: async () => response({token: 'private-test-token'}, 403)}),
        (error) => /HTTP 403.*saved receipt only/.test(error.message) && !error.message.includes('private-test-token'));
});

test('OTA saves a receipt and uploads maps before recording a successful deployment', async (t) => {
    const [, {runEas}] = await modules;
    const f = fixture(t);
    const calls = [];
    const args = ['update', '--json', '--channel', 'Production'];
    assert.equal(await runEas('/eas', args, {...f,
        run: async (_command, forwarded, options) => {
            assert.deepEqual(forwarded, ['/eas', ...args]);
            options.onStdout(JSON.stringify([update])); calls.push('publish'); return 0;
        },
        upload: async () => { assert.ok(fs.existsSync(`${f.planPath}.published.json`)); calls.push('maps'); },
        record: async (value) => { assert.deepEqual(value, receipt); calls.push('metadata'); },
    }), 0);
    assert.deepEqual(calls, ['publish', 'maps', 'metadata']);
});

test('failed and cancelled publication never create metadata receipts', async (t) => {
    const [, {runEas}] = await modules;
    const f = fixture(t);
    for (const code of [1, 130]) {
        assert.equal(await runEas('/eas', ['update', '--json', '--channel', 'Production'], {...f,
            run: async () => code, upload: () => assert.fail('must not upload'), record: () => assert.fail('must not record'),
        }), code);
        assert.equal(fs.existsSync(`${f.planPath}.published.json`), false);
    }
});

test('post-publication metadata failure gives a metadata-only retry and preserves the receipt', async (t) => {
    const [, {runEas}] = await modules;
    const f = fixture(t);
    let publishes = 0;
    await assert.rejects(runEas('/eas', ['update', '--json', '--channel', 'Production'], {...f,
        run: async (_command, _args, options) => { publishes += 1; options.onStdout(JSON.stringify([update])); return 0; },
        upload: async () => {}, record: async () => { throw new Error('HTTP 503'); },
    }), /publication succeeded.*Retry only: node scripts\/sentry-release.mjs/);
    assert.equal(publishes, 1);
    assert.deepEqual(JSON.parse(fs.readFileSync(`${f.planPath}.published.json`)), receipt);
});

test('Pages uses the exported release and workflow source identity, never a later checkout version', async () => {
    const [{githubPagesReceipt}] = await modules;
    const value = githubPagesReceipt({GITHUB_REPOSITORY: 'kunal26das/yify', GITHUB_RUN_ID: '123',
        GITHUB_RUN_ATTEMPT: '2', GITHUB_SHA: commit, SENTRY_RELEASE: 'Yify@1.7.7'},
    'https://kunal26das.github.io/yify/', receipt.dateFinished);
    assert.equal(value.name, 'github-pages:123:2');
    assert.deepEqual(value.releases, ['Yify@1.7.7']);
    assert.equal(value.commit, commit);
});

test('plan mistakes are rejected before any Expo publication starts', async (t) => {
    const [, {runEas}] = await modules;
    const f = fixture(t);
    const options = {...f, run: () => assert.fail('must not publish')};
    await assert.rejects(runEas('/eas', ['update'], options), /requires --json/);
    await assert.rejects(runEas('/eas', ['deploy', '--json'], options), /must match the EAS operation/);
    await assert.rejects(runEas('/eas', ['update', '--json', '--channel', 'Staging'], options), /does not match the Expo channel/);
    fs.writeFileSync(f.planPath, JSON.stringify({kind: 'hosting', releases: {web: 'Yify@1.7.7'},
        commit, environment: 'preview'}));
    await assert.rejects(runEas('/eas', ['deploy', '--json'], {...options,
        env: {...f.env, EXPO_PUBLIC_SENTRY_ENVIRONMENT: 'production'}}), /does not match EXPO_PUBLIC_SENTRY_ENVIRONMENT/);
});

test('map upload failure retains the successful receipt and skips release metadata until maps are retried', async (t) => {
    const [, {runEas}] = await modules;
    const f = fixture(t);
    await assert.rejects(runEas('/eas', ['update', '--json', '--channel', 'Production'], {...f,
        run: async (_command, _args, options) => { options.onStdout(JSON.stringify([update])); return 0; },
        upload: async () => { throw new Error('map upload failed'); }, record: () => assert.fail('metadata must wait'),
    }), /was published.*sentry-sourcemaps.mjs.*then node scripts\/sentry-release.mjs/);
    assert.deepEqual(JSON.parse(fs.readFileSync(`${f.planPath}.published.json`)), receipt);
});

test('stdout observation preserves the exact child JSON stream for callers', async () => {
    const {spawnSync} = require('node:child_process');
    const {pathToFileURL} = require('node:url');
    const moduleUrl = pathToFileURL(path.resolve(__dirname, '../scripts/sentry-sourcemaps.mjs')).href;
    const result = spawnSync(process.execPath, ['--input-type=module', '-e', `
        import {runCommand} from ${JSON.stringify(moduleUrl)};
        let captured = '';
        const code = await runCommand(process.execPath, ['-e', 'process.stdout.write(JSON.stringify({published: true}))'], {
            onStdout: (chunk) => { captured += chunk; },
        });
        if (code !== 0 || JSON.parse(captured).published !== true) process.exitCode = 1;
    `], {encoding: 'utf8'});
    assert.equal(result.status, 0, result.stderr);
    assert.equal(result.stdout, '{"published":true}');
});


test('deployment source verification rejects a later commit and uncommitted source', async (t) => {
    const {execFileSync} = require('node:child_process');
    const [{verifyPlannedSource}] = await modules;
    const f = fixture(t);
    const git = (...args) => execFileSync('git', args, {cwd: f.cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe']}).trim();
    git('init');
    git('config', 'user.name', 'Release test');
    git('config', 'user.email', 'release-test@example.invalid');
    git('add', '.');
    git('commit', '-m', 'Known source');
    const actualPlan = {...plan, commit: git('rev-parse', 'HEAD')};
    assert.doesNotThrow(() => verifyPlannedSource(actualPlan, f.cwd));
    assert.throws(() => verifyPlannedSource(plan, f.cwd), /clean checkout at its exact source commit/);
    fs.writeFileSync(path.join(f.cwd, 'new-source.ts'), 'throw new Error("different source");');
    assert.throws(() => verifyPlannedSource(actualPlan, f.cwd), /clean checkout at its exact source commit/);
});


test('a successful OTA uploads source maps even when its deployment receipt cannot be verified', async (t) => {
    const [, {runEas}] = await modules;
    const f = fixture(t);
    for (const stdout of ['not valid JSON', JSON.stringify([{...update, runtimeVersion: 'unexpected-runtime'}])]) {
        let uploaded = false;
        await assert.rejects(runEas('/eas', ['update', '--json', '--channel', 'Production'], {...f,
            run: async (_command, _args, options) => { options.onStdout(stdout); return 0; },
            upload: async () => { uploaded = true; }, record: () => assert.fail('must not record unverified metadata'),
        }), /publication succeeded.*receipt could not be verified.*do not republish/);
        assert.equal(uploaded, true);
        assert.equal(fs.readFileSync(`${f.planPath}.eas.json`, 'utf8'), stdout);
        assert.equal(fs.existsSync(`${f.planPath}.published.json`), false);
    }
});

test('combined receipt and map failures retain raw evidence and give only a valid map retry', async (t) => {
    const [, {runEas}] = await modules;
    const f = fixture(t);
    let publishes = 0;
    await assert.rejects(runEas('/eas', ['update', '--json', '--channel', 'Production'], {...f,
        run: async (_command, _args, options) => { publishes += 1; options.onStdout('invalid JSON'); return 0; },
        upload: async () => { throw new Error('map upload failed'); }, record: () => assert.fail('must not record'),
    }), (error) => /was published.*map upload failed.*sentry-sourcemaps.mjs.*receipt could not be verified.*do not republish/.test(error.message)
        && !error.message.includes('then node scripts/sentry-release.mjs'));
    assert.equal(publishes, 1);
    assert.equal(fs.readFileSync(`${f.planPath}.eas.json`, 'utf8'), 'invalid JSON');
    assert.equal(fs.existsSync(`${f.planPath}.published.json`), false);
});


test('preview hosting plans cannot publish or record a production promotion', async (t) => {
    const [{completePlan}, {runEas}] = await modules;
    const f = fixture(t);
    const preview = {kind: 'hosting', releases: {web: 'Yify@1.7.7'}, commit, environment: 'preview'};
    fs.writeFileSync(f.planPath, JSON.stringify(preview));
    for (const flag of ['--prod', '--production', '--prod=true', '--production=true']) {
        await assert.rejects(runEas('/eas', ['deploy', '--json', flag], {...f,
            upload: () => assert.fail('must not upload'), run: () => assert.fail('must not publish'),
        }), /preview hosting plan cannot promote/);
    }
    assert.throws(() => completePlan(preview, {identifier: 'my-deploy', url: 'https://my-deploy.expo.app',
        production: {url: 'https://yify.expo.app'}}), /confirms production promotion but its plan is not production/);
});

test('planned OTA requires an explicit supported channel consistent with its configured channel', async (t) => {
    const [, {runEas}] = await modules;
    const f = fixture(t);
    for (const args of [['update', '--json'], ['update', '--json', '--channel', 'unverified-channel']]) {
        await assert.rejects(runEas('/eas', args, {...f, run: () => assert.fail('must not publish')}),
            /requires an explicit Production or Staging/);
    }
    await assert.rejects(runEas('/eas', ['update', '--json', '--channel', 'Production'], {...f,
        env: {...f.env, EXPO_UPDATE_CHANNEL: 'Staging'}, run: () => assert.fail('must not publish'),
    }), /does not match EXPO_UPDATE_CHANNEL/);
});


test('planned hosting rejects a stale exported Sentry release before uploading maps or publishing', async (t) => {
    const [{verifyWebExportRelease}, {runEas}] = await modules;
    const f = fixture(t);
    const hosting = {kind: 'hosting', releases: {web: 'Yify@1.7.7'}, commit, environment: 'preview'};
    fs.writeFileSync(f.planPath, JSON.stringify(hosting));
    const directory = path.join(f.cwd, 'export');
    const webDirectory = path.join(directory, '_expo', 'static', 'js', 'web');
    fs.mkdirSync(webDirectory, {recursive: true});
    const entry = path.join(webDirectory, 'entry-bundle.js');
    fs.writeFileSync(entry, 'var SENTRY_RELEASE;SENTRY_RELEASE={name: "Yify", version: "1.7.6"};');
    await assert.rejects(runEas('/eas', ['deploy', '--json', '--export-dir', directory], {...f,
        upload: () => assert.fail('must not upload stale maps'), run: () => assert.fail('must not publish stale export'),
    }), /web export Sentry release is Yify@1.7.6.*expects Yify@1.7.7/);
    fs.writeFileSync(entry, 'var SENTRY_RELEASE;SENTRY_RELEASE={name: "Yify", version: "1.7.7"};');
    assert.doesNotThrow(() => verifyWebExportRelease(directory, 'Yify@1.7.7'));
    fs.writeFileSync(entry, 'console.log("missing release prelude");');
    assert.throws(() => verifyWebExportRelease(directory, 'Yify@1.7.7'), /no unambiguous Sentry release prelude/);
});
