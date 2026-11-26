const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

const privacy = import('../../scripts/check-live-privacy.mjs');
const canonical = 'https://yify.expo.app/privacy/';
const store = 'https://yify.expo.app/privacy.html';
const policy = fs.readFileSync(require.resolve('../../public/privacy.html'), 'utf8');

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
    const {checkLivePrivacy} = await privacy;
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

test('either address failing stops the Android production handoff', async (t) => {
    const {checkLivePrivacy} = await privacy;
    const f = fixture(t);
    for (const badUrl of [canonical, store]) {
        await assert.rejects(checkLivePrivacy({...f, fetch: async (url) => url === badUrl ? html('Not found', 404) : html()}),
            /HTTP 404.*handoff stopped/);
    }
});

test('200 app shells, login pages, missing contact, and non-HTML responses fail closed', async (t) => {
    const {checkLivePrivacy} = await privacy;
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
    const {checkLivePrivacy} = await privacy;
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

test('timeout aborts stalled connections and body reads', async (t) => {
    const {checkLivePrivacy} = await privacy;
    const f = fixture(t);
    for (const stallBody of [false, true]) {
        const signals = [];
        await assert.rejects(checkLivePrivacy({...f, timeoutMs: 15, fetch: async (_url, {signal}) => {
            signals.push(signal);
            if (!stallBody) return new Promise((_resolve, reject) => signal.addEventListener('abort', () => reject(signal.reason), {once: true}));
            return new Response(new ReadableStream({start(controller) {
                signal.addEventListener('abort', () => controller.error(signal.reason), {once: true});
            }}), {headers: {'content-type': 'text/html'}});
        }}), /timed out/);
        assert.equal(signals.length, 2);
        assert.ok(signals.every((signal) => signal.aborted));
    }
});

test('production builds, submissions, auto-submits, aliases and inherited profiles require the live check', async (t) => {
    const {requiresLivePrivacyCheck} = await privacy;
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
        assert.equal(requiresLivePrivacyCheck(args, f.cwd), true, args.join(' '));
    }
});

test('preview, staging, iOS, help, dry-run, and read-only commands never contact the legal site', async (t) => {
    const {requiresLivePrivacyCheck} = await privacy;
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
        assert.equal(requiresLivePrivacyCheck(args, f.cwd), false, args.join(' '));
    }
});
