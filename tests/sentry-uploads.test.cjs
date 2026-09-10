const assert = require('node:assert/strict');
const {spawn} = require('node:child_process');
const {once} = require('node:events');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const {pathToFileURL} = require('node:url');
const test = require('node:test');

const wrappers = Promise.all([
    import('../scripts/eas-with-sentry.mjs'),
    import('../scripts/sentry-sourcemaps.mjs'),
]);

function fixture(t) {
    const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'yify-sentry-'));
    t.after(() => fs.rmSync(cwd, {recursive: true, force: true}));
    const directory = path.join(cwd, 'custom export');
    fs.mkdirSync(directory);
    const bundle = path.join(directory, 'entry.js');
    const sourceMap = `${bundle}.map`;
    fs.writeFileSync(bundle, 'console.log("bundle");');
    fs.writeFileSync(sourceMap, JSON.stringify({version: 3, debugId: '6a70c1d0-6cc2-4f91-9366-6a3edc8ae612'}));
    return {cwd, directory, sourceMap, env: {SENTRY_AUTH_TOKEN: 'test-upload-credential'}};
}

function hostingFixture(t) {
    const f = fixture(t);
    const clientDirectory = path.join(f.directory, 'client', '_expo', 'static', 'js', 'web');
    fs.mkdirSync(clientDirectory, {recursive: true});
    const clientBundle = path.join(clientDirectory, 'entry.js');
    fs.renameSync(f.sourceMap.slice(0, -4), clientBundle);
    fs.renameSync(f.sourceMap, `${clientBundle}.map`);
    const serverBundle = path.join(f.directory, 'server', '_expo', 'functions', 'api', 'catalog', '[operation]+api.js');
    fs.mkdirSync(path.dirname(serverBundle), {recursive: true});
    fs.writeFileSync(serverBundle, 'module.exports = {GET: () => "metadata"};');
    fs.writeFileSync(`${serverBundle}.map`, JSON.stringify({version: 3, sources: ['catalog.ts'], sourcesContent: ['export const GET = () => "metadata";'], names: [], mappings: 'AAAA'}));
    return {...f, clientBundle, serverBundle, sourceMap: `${clientBundle}.map`, serverMap: `${serverBundle}.map`};
}

test('missing upload credentials block a publish before EAS is started', async (t) => {
    const [{runEas}] = await wrappers;
    const f = fixture(t);
    let ran = false;
    await assert.rejects(runEas('/eas', ['update'], {
        cwd: f.cwd, env: {}, run: async () => { ran = true; return 0; },
    }), /SENTRY_AUTH_TOKEN is required before publishing/);
    assert.equal(ran, false);
});

test('help, read-only commands, and deployment dry runs do not require upload credentials', async (t) => {
    const [{runEas}] = await wrappers;
    const f = fixture(t);
    for (const args of [['update', '--help'], ['update:list'], ['deploy', '--dry-run']]) {
        let forwarded;
        assert.equal(await runEas('/eas', args, {
            cwd: f.cwd, env: {}, run: async (_command, cliArgs) => { forwarded = cliArgs; return 0; },
        }), 0);
        assert.deepEqual(forwarded, ['/eas', ...args]);
    }
});

test('successful OTA uploads its actual export directory and leaves EAS JSON flags intact', async (t) => {
    const [{runEas}] = await wrappers;
    const f = fixture(t);
    for (const directoryFlags of [
        ['--input-dir', f.directory],
        [`--input-dir=${f.directory}`],
        ['--input-dir=/outdated/export', '--input-dir', f.directory],
        ['--input-dir', '/outdated/export', `--input-dir=${f.directory}`],
    ]) {
        const calls = [];
        const args = ['update', ...directoryFlags, '--skip-bundler', '--json'];
        assert.equal(await runEas('/eas', args, {
            ...f,
            run: async (_command, cliArgs) => { calls.push(['publish', cliArgs]); return 0; },
            upload: async (directory) => { calls.push(['upload', directory]); },
        }), 0);
        assert.deepEqual(calls, [['publish', ['/eas', ...args]], ['upload', f.directory]]);
    }
});

test('a failed publish never uploads stale maps left in the export directory', async (t) => {
    const [{runEas}] = await wrappers;
    const f = fixture(t);
    let uploaded = false;
    assert.equal(await runEas('/eas', ['update', '--input-dir', f.directory], {
        ...f, run: async () => 1, upload: async () => { uploaded = true; },
    }), 1);
    assert.equal(uploaded, false);
});

test('an upload failure after an OTA reports that the update was already published without retrying it', async (t) => {
    const [{runEas}] = await wrappers;
    const f = fixture(t);
    let publishes = 0;
    await assert.rejects(runEas('/eas', ['update', '--input-dir', f.directory], {
        ...f, run: async () => { publishes += 1; return 0; },
        upload: async () => { throw new Error('upload failed'); },
    }), /Expo update was published.*Retry only: node scripts\/sentry-sourcemaps\.mjs/);
    assert.equal(publishes, 1);
    assert.equal(fs.existsSync(f.sourceMap), true);
});

test('skip-bundler refuses missing or uninstrumented source maps before publishing', async (t) => {
    const [{runEas}] = await wrappers;
    const f = fixture(t);
    let ran = false;
    fs.writeFileSync(f.sourceMap, JSON.stringify({version: 3}));
    const options = {...f, run: async () => { ran = true; return 0; }};
    await assert.rejects(runEas('/eas', ['update', '--skip-bundler', '--input-dir', f.directory], options), /Sentry Debug ID/);
    fs.unlinkSync(f.sourceMap);
    await assert.rejects(runEas('/eas', ['update', '--skip-bundler', '--input-dir', f.directory], options), /No JavaScript source maps/);
    assert.equal(ran, false);
});

test('web hosting uploads and removes maps before deployment, with upload output routed to stderr', async (t) => {
    const [{runEas}] = await wrappers;
    const f = fixture(t);
    const calls = [];
    assert.equal(await runEas('/eas', ['deploy', '--export-dir', f.directory, '--json'], {
        ...f,
        run: async (_command, args, options) => {
            if (args[0] === '/eas') {
                assert.equal(fs.existsSync(f.sourceMap), false);
                calls.push('deploy');
            } else {
                assert.equal(args[1], f.directory);
                assert.equal(options.stderrOnly, true);
                assert.equal(fs.existsSync(f.sourceMap), true);
                calls.push('upload');
            }
            return 0;
        },
    }), 0);
    assert.deepEqual(calls, ['upload', 'deploy']);
});

test('failed web upload preserves maps and prevents deployment', async (t) => {
    const [{runEas}] = await wrappers;
    const f = fixture(t);
    const calls = [];
    await assert.rejects(runEas('/eas', ['deploy', '--export-dir', f.directory], {
        ...f, run: async (_command, args) => { calls.push(args[0]); return 1; },
    }), /Sentry source-map upload failed/);
    assert.equal(calls.length, 1);
    assert.notEqual(calls[0], '/eas');
    assert.equal(fs.existsSync(f.sourceMap), true);
});

test('Hosting prepares matching server Debug IDs without changing client artifacts, then uploads before stripping', async (t) => {
    const [, {uploadSourceMaps, runCommand}] = await wrappers;
    const f = hostingFixture(t);
    const clientBundle = fs.readFileSync(f.clientBundle, 'utf8');
    const clientMap = fs.readFileSync(f.sourceMap, 'utf8');
    const calls = [];
    await uploadSourceMaps(f.directory, {...f, strip: true, run: async (command, args, options) => {
        assert.equal(options.stderrOnly, true);
        if (args[1] === 'sourcemaps') {
            calls.push('inject');
            assert.deepEqual(args.slice(1), ['sourcemaps', 'inject', path.join(f.directory, 'server')]);
            return runCommand(command, args, options);
        }
        calls.push('upload');
        const map = JSON.parse(fs.readFileSync(f.serverMap, 'utf8'));
        const debugId = map.debugId || map.debug_id;
        assert.match(debugId, /^[a-f0-9-]{36}$/);
        assert.ok(fs.readFileSync(f.serverBundle, 'utf8').includes(debugId));
        assert.equal(fs.readFileSync(f.clientBundle, 'utf8'), clientBundle);
        assert.equal(fs.readFileSync(f.sourceMap, 'utf8'), clientMap);
        return 0;
    }});
    assert.deepEqual(calls, ['inject', 'upload']);
    assert.equal(fs.existsSync(f.sourceMap), false);
    assert.equal(fs.existsSync(f.serverMap), false);
    assert.equal(fs.existsSync(f.serverBundle), true);
});

test('server Debug ID preparation is stable when retried after a failed upload', async (t) => {
    const [, {prepareServerSourceMaps, uploadSourceMaps, runCommand}] = await wrappers;
    const f = hostingFixture(t);
    await assert.rejects(uploadSourceMaps(f.directory, {...f, strip: true, run: async (command, args, options) => {
        return args[1] === 'sourcemaps' ? runCommand(command, args, options) : 1;
    }}), /Sentry source-map upload failed/);
    const bundle = fs.readFileSync(f.serverBundle, 'utf8');
    const map = fs.readFileSync(f.serverMap, 'utf8');
    await prepareServerSourceMaps(f.directory, {...f, run: runCommand});
    assert.equal(fs.readFileSync(f.serverBundle, 'utf8'), bundle);
    assert.equal(fs.readFileSync(f.serverMap, 'utf8'), map);
    assert.equal(fs.existsSync(f.sourceMap), true);
});

test('failed or ineffective server preparation preserves maps and prevents upload', async (t) => {
    const [, {uploadSourceMaps}] = await wrappers;
    for (const code of [1, 0]) {
        const f = hostingFixture(t);
        const calls = [];
        await assert.rejects(uploadSourceMaps(f.directory, {...f, strip: true, run: async (_command, args) => {
            calls.push(args[1]);
            return code;
        }}), code ? /server source-map preparation failed/ : /Sentry Debug ID/);
        assert.deepEqual(calls, ['sourcemaps']);
        assert.equal(fs.existsSync(f.sourceMap), true);
        assert.equal(fs.existsSync(f.serverMap), true);
    }
});

test('cancelling the OTA wrapper stops EAS and never starts the upload even when EAS exits cleanly', async (t) => {
    const f = fixture(t);
    const fakeEas = path.join(f.cwd, 'eas.cjs');
    const cancelled = path.join(f.cwd, 'cancelled');
    const uploaded = path.join(f.cwd, 'uploaded');
    fs.writeFileSync(fakeEas, `
        const fs = require('node:fs');
        process.on('SIGTERM', () => { fs.writeFileSync(${JSON.stringify(cancelled)}, 'yes'); process.exit(0); });
        console.log('EAS_READY');
        setInterval(() => {}, 1000);
    `);
    const moduleUrl = pathToFileURL(path.resolve(__dirname, '../scripts/eas-with-sentry.mjs')).href;
    const source = `
        import fs from 'node:fs';
        import {runEas} from ${JSON.stringify(moduleUrl)};
        process.exitCode = await runEas(${JSON.stringify(fakeEas)}, ['update'], {
            cwd: ${JSON.stringify(f.cwd)}, env: {SENTRY_AUTH_TOKEN: 'test-upload-credential'},
            upload: async () => fs.writeFileSync(${JSON.stringify(uploaded)}, 'yes'),
        });
    `;
    const child = spawn(process.execPath, ['--input-type=module', '-e', source], {stdio: ['ignore', 'pipe', 'pipe']});
    t.after(() => child.kill('SIGKILL'));
    const closed = once(child, 'close');
    await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error('Fake EAS did not start')), 5_000);
        child.stdout.on('data', (data) => {
            if (data.toString().includes('EAS_READY')) { clearTimeout(timeout); resolve(); }
        });
        child.once('error', reject);
    });
    child.kill('SIGTERM');
    assert.deepEqual(await closed, [130, null]);
    assert.equal(fs.existsSync(cancelled), true);
    assert.equal(fs.existsSync(uploaded), false);
});
