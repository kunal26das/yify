const assert = require('node:assert/strict');
const {spawn} = require('node:child_process');
const {once} = require('node:events');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const {pathToFileURL} = require('node:url');

const modules = Promise.all([import('../scripts/check-live-privacy.mjs'), import('../scripts/eas-with-sentry.mjs')]);
const canonical = 'https://yify.expo.app/privacy/';
const store = 'https://yify.expo.app/privacy.html';
const policy = fs.readFileSync(require.resolve('../public/privacy.html'), 'utf8');

function html(body = policy, status = 200) {
    return new Response(body, {status, headers: {'content-type': 'text/html; charset=utf-8'}});
}

function fixture(t) {
    const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'yify-privacy-'));
    fs.mkdirSync(path.join(cwd, 'public'));
    fs.writeFileSync(path.join(cwd, 'public', 'privacy.html'), policy);
    fs.writeFileSync(path.join(cwd, 'eas.json'), JSON.stringify({
        build: {
            production: {environment: 'production'}, preview: {environment: 'preview', distribution: 'internal'},
            staging: {environment: 'preview'}, inherited: {extends: 'production'},
        },
        submit: {
            production: {android: {track: 'internal'}}, 'play-production': {extends: 'production', android: {track: 'production'}},
            preview: {android: {track: 'internal'}}, staging: {android: {track: 'internal'}},
            inherited: {extends: 'play-production'},
        },
    }));
    t.after(() => fs.rmSync(cwd, {recursive: true, force: true}));
    return {cwd};
}

test('both app and Play privacy addresses require unauthenticated GETs, including the live redirect', async (t) => {
    const [{checkLivePrivacy}] = await modules;
    const f = fixture(t);
    const calls = [];
    await checkLivePrivacy({...f, fetch: async (url, options) => {
        calls.push(url);
        assert.equal(options.method, 'GET');
        assert.equal(options.credentials, 'omit');
        assert.equal(options.cache, 'no-store');
        assert.equal(options.redirect, 'manual');
        assert.deepEqual(options.headers, {Accept: 'text/html'});
        assert.ok(options.signal instanceof AbortSignal);
        if (url === canonical) return new Response(null, {status: 308, headers: {location: '/privacy.html'}});
        assert.equal(url, store);
        return html();
    }});
    assert.deepEqual(calls.sort(), [canonical, store, store].sort());
});

test('either address failing blocks EAS before its remote handoff', async (t) => {
    const [{checkLivePrivacy}, {runEas}] = await modules;
    const f = fixture(t);
    for (const badUrl of [canonical, store]) {
        let handoffs = 0;
        await assert.rejects(runEas('/eas', ['build', '--platform', 'android', '--profile', 'production', '--auto-submit-with-profile', 'play-production'], {
            ...f, env: {EXPO_TOKEN: 'must-not-be-sent-to-policy'}, run: async () => { handoffs += 1; return 0; },
            verifyPrivacy: (options) => checkLivePrivacy({...options, fetch: async (url) => url === badUrl ? html('Not found', 404) : html()}),
        }), /HTTP 404.*handoff stopped/);
        assert.equal(handoffs, 0);
    }
});

test('200 app shells, login pages, missing contact, and non-HTML responses fail closed', async (t) => {
    const [{checkLivePrivacy}] = await modules;
    const f = fixture(t);
    for (const response of [
        () => html('<html><title>Privacy Policy</title><div id="root"></div></html>'),
        () => html('<h1>Sign in</h1><a href="mailto:kunal26das@gmail.com">Contact</a>'),
        () => html('<h1>Privacy Policy</h1><p>mailto:kunal26das@gmail.com</p>'),
        () => new Response(policy, {headers: {'content-type': 'application/json'}}),
        () => html('<script><h1>Privacy Policy</h1><a href="mailto:kunal26das@gmail.com">Contact</a></script>'),
    ]) {
        await assert.rejects(checkLivePrivacy({...f, fetch: async () => response()}), /Live privacy check failed/);
    }
});

test('redirects cannot downgrade HTTPS, require authentication, omit their location, or loop indefinitely', async (t) => {
    const [{checkLivePrivacy}] = await modules;
    const f = fixture(t);
    for (const location of ['http://yify.expo.app/privacy.html', 'https://user:secret@yify.expo.app/privacy.html', null, '/privacy/']) {
        let calls = 0;
        await assert.rejects(checkLivePrivacy({...f, fetch: async () => {
            calls += 1;
            return new Response(null, {status: 302, headers: location ? {location} : {}});
        }}), /Live privacy check failed/);
        assert.ok(calls <= 8);
    }
});

test('timeout aborts stalled connections and body reads before any handoff', async (t) => {
    const [{checkLivePrivacy}, {runEas}] = await modules;
    const f = fixture(t);
    for (const stallBody of [false, true]) {
        let handoffs = 0;
        const signals = [];
        await assert.rejects(runEas('/eas', ['submit', '-p', 'android', '-e', 'play-production'], {
            ...f, run: async () => { handoffs += 1; return 0; },
            verifyPrivacy: (options) => checkLivePrivacy({...options, timeoutMs: 15, fetch: async (_url, {signal}) => {
                signals.push(signal);
                if (!stallBody) return new Promise((_resolve, reject) => signal.addEventListener('abort', () => reject(signal.reason), {once: true}));
                return new Response(new ReadableStream({start(controller) {
                    signal.addEventListener('abort', () => controller.error(signal.reason), {once: true});
                }}), {headers: {'content-type': 'text/html'}});
            }}),
        }), /timed out/);
        assert.equal(handoffs, 0);
        assert.equal(signals.length, 2);
        assert.ok(signals.every((signal) => signal.aborted));
    }
});

test('production build, submission, auto-submit, aliases and inherited profiles check before forwarding unchanged arguments', async (t) => {
    const [, {runEas}] = await modules;
    const f = fixture(t);
    for (const args of [
        ['build', '--platform', 'android', '--profile', 'production', '--auto-submit', '--json'],
        ['build', '-p', 'android', '-e', 'production', '--auto-submit-with-profile', 'play-production'],
        ['build', '--platform=all', '--profile=inherited'],
        ['build', '--platform', 'android', '--profile', 'preview', '--auto-submit-with-profile=play-production'],
        ['submit', '--platform=android', '--profile=play-production', '--latest'],
        ['build:submit', '-p=android', '-e=play-production'],
        ['submit', '--platform', 'android', '--profile', 'inherited'],
        ['build'], ['submit', '-p', 'android'],
    ]) {
        const events = [];
        const env = {EXPO_TOKEN: 'configured-session'};
        assert.equal(await runEas('/eas', args, {
            ...f, env, verifyPrivacy: async ({cwd}) => { assert.equal(cwd, f.cwd); events.push('check'); },
            run: async (_command, forwarded, options) => {
                events.push('handoff');
                assert.deepEqual(forwarded, ['/eas', ...args]);
                assert.equal(options.env, env);
                return 7;
            },
        }), 7);
        assert.deepEqual(events, ['check', 'handoff']);
    }
});

test('preview, staging, iOS, help, dry-run, and read-only commands never contact the legal site', async (t) => {
    const [, {runEas}] = await modules;
    const f = fixture(t);
    for (const args of [
        ['build', '--platform', 'android', '--profile', 'preview'],
        ['submit', '--platform', 'android', '--profile', 'staging'],
        ['build', '--platform', 'android', '--profile', 'staging'],
        ['build', '--profile', 'production', '--platform', 'ios'],
        ['submit', '-e', 'play-production', '-p', 'ios'],
        ['build', '--help'], ['submit', '-h'], ['build', '--dry-run'], ['submit', '--dry-run'],
        ['build:list'], ['submission:details'], ['update:list'], ['deploy', '--dry-run'],
    ]) {
        let handoffs = 0;
        assert.equal(await runEas('/eas', args, {
            ...f, env: {}, verifyPrivacy: async () => assert.fail('Unexpected live check'),
            run: async () => { handoffs += 1; return 0; },
        }), 0);
        assert.equal(handoffs, 1);
    }
});

test('production wrapper cancellation reaches the EAS child and returns a cancelled handoff', async (t) => {
    const f = fixture(t);
    const fakeEas = path.join(f.cwd, 'eas.cjs');
    const cancelled = path.join(f.cwd, 'cancelled');
    fs.writeFileSync(fakeEas, `
        const fs = require('node:fs');
        process.on('SIGTERM', () => { fs.writeFileSync(${JSON.stringify(cancelled)}, 'yes'); process.exit(0); });
        console.log('EAS_READY');
        setInterval(() => {}, 1000);
    `);
    const moduleUrl = pathToFileURL(require.resolve('../scripts/eas-with-sentry.mjs')).href;
    const source = `
        import {runEas} from ${JSON.stringify(moduleUrl)};
        process.exitCode = await runEas(${JSON.stringify(fakeEas)}, ['build', '--platform', 'android', '--profile', 'production'], {
            cwd: ${JSON.stringify(f.cwd)}, env: {}, verifyPrivacy: async () => {},
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
});
