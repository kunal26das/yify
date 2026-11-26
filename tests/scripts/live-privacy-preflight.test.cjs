const assert = require('node:assert/strict');
const {execFile} = require('node:child_process');
const fs = require('node:fs');
const http = require('node:http');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const {promisify} = require('node:util');

const privacy = import('../../scripts/check-live-privacy.mjs');
const root = path.resolve(__dirname, '../..');
const canonical = 'https://yify.expo.app/privacy.html';
const folder = 'https://yify.expo.app/privacy/';
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

test('the canonical page and the folder twin that 1.8 apps link to both require unauthenticated GETs, including a live redirect', async (t) => {
    const {checkLivePrivacy} = await privacy;
    const f = fixture(t);
    const calls = [];
    const checked = await checkLivePrivacy({...f, fetch: async (url, options) => {
        calls.push(url);
        assert.equal(options.method, 'GET');
        assert.equal(options.credentials, 'omit');
        assert.equal(options.cache, 'no-store');
        assert.equal(options.redirect, 'manual');
        assert.deepEqual(options.headers, {Accept: 'text/html'});
        assert.ok(options.signal instanceof AbortSignal);
        if (url === folder) return new Response(null, {status: 308, headers: {location: '/privacy.html'}});
        assert.equal(url, canonical);
        return html();
    }});
    assert.deepEqual(checked, [canonical, folder]);
    assert.deepEqual(calls.sort(), [canonical, canonical, folder].sort());
});

test('the published addresses come from the canonical link of the committed policy', async () => {
    const {publishedPrivacyUrls} = await privacy;
    assert.deepEqual(publishedPrivacyUrls(policy), {urls: [canonical, folder], contact: 'mailto:kunal26das@gmail.com'});
    assert.throws(() => publishedPrivacyUrls('<link rel="canonical" href="http://yify.expo.app/privacy.html"><a href="mailto:a@b.c">'), /HTTPS/);
    assert.throws(() => publishedPrivacyUrls('<h1>Privacy Policy</h1>'), /canonical URL and contact/);
});

test('either address failing stops the Android production handoff', async (t) => {
    const {checkLivePrivacy} = await privacy;
    const f = fixture(t);
    for (const badUrl of [canonical, folder]) {
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

test('--url accepts a deployed privacy page after at most three redirects', async () => {
    const {checkPrivacyUrl} = await privacy;
    const preview = 'https://yify--v2.expo.app/privacy';
    const calls = [];
    const checked = await checkPrivacyUrl(preview, {fetch: async (url, options) => {
        calls.push(url);
        assert.equal(options.redirect, 'manual');
        assert.equal(options.credentials, 'omit');
        if (url === preview) return new Response(null, {status: 301, headers: {location: '/privacy.html'}});
        assert.equal(url, 'https://yify--v2.expo.app/privacy.html');
        return html();
    }});
    assert.equal(checked, preview);
    assert.deepEqual(calls, [preview, 'https://yify--v2.expo.app/privacy.html']);
});

test('--url rejects other statuses, non-HTML, pages without a Privacy heading, insecure hops and redirect loops', async () => {
    const {checkPrivacyUrl} = await privacy;
    const url = 'https://yify.expo.app/privacy.html';
    for (const response of [
        () => html(policy, 404),
        () => html(policy, 203),
        () => new Response(policy, {headers: {'content-type': 'application/json'}}),
        () => html('<html><title>Privacy</title><div id="root"></div><a href="/privacy.html">Privacy</a></html>'),
        () => html('<script><h1>Privacy Policy</h1></script>'),
        () => new Response(null, {status: 302, headers: {location: 'http://yify.expo.app/privacy.html'}}),
        () => new Response(null, {status: 302, headers: {location: '/privacy.html'}}),
        () => new Response(null, {status: 302}),
    ]) {
        await assert.rejects(checkPrivacyUrl(url, {fetch: async () => response()}), /Privacy URL check failed/);
    }
    for (const bad of ['http://yify.expo.app/privacy.html', 'https://user:secret@yify.expo.app/privacy.html', 'ftp://127.0.0.1/privacy.html', 'not a url']) {
        await assert.rejects(checkPrivacyUrl(bad, {fetch: async () => assert.fail('no request for a rejected URL')}), /Privacy URL check failed/);
    }
    assert.equal(await checkPrivacyUrl('http://127.0.0.1:8810/privacy.html', {fetch: async () => html()}), 'http://127.0.0.1:8810/privacy.html');
});

test('--url times out stalled requests', async () => {
    const {checkPrivacyUrl} = await privacy;
    await assert.rejects(checkPrivacyUrl('https://yify.expo.app/privacy.html', {timeoutMs: 15, fetch: async (_url, {signal}) =>
        new Promise((_resolve, reject) => signal.addEventListener('abort', () => reject(signal.reason), {once: true}))}), /timed out/);
});

test('the command line takes no arguments or exactly one --url', async () => {
    const {parseArguments} = await privacy;
    assert.deepEqual(parseArguments([]), {mode: 'published'});
    assert.deepEqual(parseArguments(['--url', 'https://yify.expo.app/privacy.html']), {mode: 'url', url: 'https://yify.expo.app/privacy.html'});
    assert.deepEqual(parseArguments(['--url=https://yify.expo.app/privacy.html']), {mode: 'url', url: 'https://yify.expo.app/privacy.html'});
    for (const args of [['--url'], ['--url='], ['--live'], ['--url', 'a', 'b']]) assert.throws(() => parseArguments(args), /usage:/);
});

test('node scripts/check-live-privacy.mjs --url passes against a local server that serves the committed page', async (t) => {
    const server = http.createServer((request, response) => {
        if (request.url === '/privacy') {
            response.writeHead(301, {location: '/privacy.html'});
            response.end();
        } else if (request.url === '/privacy.html') {
            response.writeHead(200, {'content-type': 'text/html; charset=utf-8'});
            response.end(policy);
        } else {
            response.writeHead(404, {'content-type': 'text/html'});
            response.end('<h1>Not found</h1>');
        }
    });
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
    t.after(() => server.close());
    const origin = `http://127.0.0.1:${server.address().port}`;
    const run = (url) => promisify(execFile)(process.execPath, ['scripts/check-live-privacy.mjs', '--url', url], {cwd: root, timeout: 20_000});
    const {stdout} = await run(`${origin}/privacy`);
    assert.match(stdout, new RegExp(`Privacy page passed: ${origin}/privacy`));
    await assert.rejects(run(`${origin}/missing.html`), (error) => error.code === 1 && /HTTP 404/.test(error.stderr));
});
