const assert = require('node:assert/strict');
const {test} = require('node:test');
const {loadTypeScript} = require('./helpers/load-typescript.cjs');

const publicBase = 'https://yify.expo.app/api/catalog';
const subscriberBase = 'https://yify.expo.app/api/subscriber-catalog';
const uploadedAt = '2026-09-19T03:27:22.000Z';

function release(patch = {}) {
    return {id: 'nyaa:123', title: '[Example] Sample anime - 02 [1080p]', category: 'english',
        uploadedAt, size: '320.5 MiB', seeds: 25, peers: 8, downloadCount: 110, ...patch};
}

function list(patch = {}) {
    return {releases: [release()], limit: 75, ...patch};
}

function client() {
    return new (loadTypeScript('data/datasources/WebCatalogClient.ts').WebCatalogClient)();
}

function setGlobal(t, name, value) {
    const descriptor = Object.getOwnPropertyDescriptor(globalThis, name);
    Object.defineProperty(globalThis, name, {configurable: true, writable: true, value});
    t.after(() => descriptor
        ? Object.defineProperty(globalThis, name, descriptor)
        : delete globalThis[name]);
}

function repositories(native = false) {
    let account = {uid: 'anime-account'};
    const listeners = new Set();
    const auth = {
        getSession: () => ({ready: true, account}),
        getIdToken: async () => 'anime-account-token',
        subscribe: listener => { listeners.add(listener); return () => listeners.delete(listener); },
    };
    const purchases = {
        getState: () => ({ready: true, adsRemoved: true, expiresAt: '2099-01-01T00:00:00.000Z'}),
        subscribe: () => () => {},
    };
    const path = native ? 'data/di/catalogRepositories.ts' : 'data/di/catalogRepositories.web.ts';
    const {createCatalogRepositories} = loadTypeScript(path);
    return {
        ...createCatalogRepositories({getApiBaseUrl() { assert.fail('Anime requested a movie provider'); }}, undefined, auth, purchases),
        signOut() {
            account = null;
            for (const listener of listeners) listener();
        },
    };
}

test('Anime projects query parameters and returns namespaced upload metadata with dates', async t => {
    const requests = [];
    t.mock.method(globalThis, 'fetch', async (url, options) => {
        requests.push({url: new URL(url), options});
        return Response.json(list({releases: [release({extraField: 'future property'})]}));
    });
    const {createCatalogRepositories} = loadTypeScript('data/di/catalogRepositories.web.ts');
    const api = createCatalogRepositories({getApiBaseUrl() { assert.fail('Native provider configuration was read'); }});
    const result = await api.anime.listAnime({query: 'space & stars', category: 'english', page: 2, url: 'https://outside.example'});
    assert.deepEqual(result, {releases: [{...release(), uploadedAt: new Date(uploadedAt)}], limit: 75});
    assert.equal(requests[0].url.pathname, '/api/catalog/anime');
    assert.deepEqual(Object.fromEntries(requests[0].url.searchParams), {query: 'space & stars', category: 'english', v: '2'});
    assert.equal(requests[0].options.redirect, 'error');
    assert.equal(requests[0].options.credentials, 'omit');
    assert.equal(requests[0].options.headers.Authorization, undefined);
});

test('Anime rejects malformed upload identities, metadata, counters and feed limits without caching failures', async t => {
    let payload;
    let requests = 0;
    t.mock.method(globalThis, 'fetch', async () => {
        requests++;
        return Response.json(payload);
    });
    const api = client();
    const invalidReleases = [
        {id: 123}, {id: '123'}, {id: 'movie:123'}, {id: 'nyaa:0'}, {id: 'nyaa:001'},
        {id: 'nyaa:1.5'}, {id: 'nyaa:-1'}, {id: 'nyaa:9007199254740992'},
        {category: 'all'}, {category: 'unknown'}, {title: ''}, {title: '   '},
        {title: 'x'.repeat(501)}, {title: 'Title\u0000suffix'}, {size: ''}, {size: 'x'.repeat(41)},
        {uploadedAt: 'bad date'}, {uploadedAt: '2026-02-30T03:27:22.000Z'},
        {uploadedAt: 'September 19, 2026'}, {seeds: -1}, {peers: '8'},
        {downloadCount: 1.5}, {downloadCount: Number.MAX_SAFE_INTEGER + 1},
    ];
    const invalidResults = [
        ...invalidReleases.map(patch => list({releases: [release(patch)]})),
        list({limit: 0}), list({limit: 101}), list({limit: '75'}), list({limit: 1.5}),
        list({releases: null}), list({releases: Array.from({length: 76}, (_, index) => release({id: `nyaa:${index + 1}`}))}),
        list({releases: [release(), release()]}),
    ];
    for (payload of invalidResults) await assert.rejects(api.listAnime({}), /catalog is unavailable/i);
    payload = list();
    assert.equal((await api.listAnime({})).releases[0].id, 'nyaa:123');
    assert.equal(requests, invalidResults.length + 1);
});

test('Anime rejects raw feed fields or links in public and subscriber metadata', async t => {
    let payload;
    t.mock.method(globalThis, 'fetch', async url => Response.json(url.includes('/subscriber-catalog/')
        ? {metadata: payload, raw: {responses: []}} : payload));
    const api = client();
    const subscriber = repositories();
    const invalid = [
        list({raw: {responses: ['<rss>private feed</rss>']}}),
        list({releases: [release({infoHash: 'a'.repeat(40)})]}),
        list({releases: [release({url: 'https://feed.example/download/123.torrent'})]}),
        list({releases: [release({extra: {magnet_url: 'magnet:?xt=urn:btih:example'}})]}),
        list({releases: [release({title: 'Watch magnet:?xt=urn:btih:example'})]}),
    ];
    for (payload of invalid) {
        await assert.rejects(api.listAnime({}), /catalog is unavailable/i);
        await assert.rejects(subscriber.anime.listAnime({}), /catalog is unavailable/i);
    }
});

test('Anime empty feeds and each supported upload category parse independently', async t => {
    let payload = list({releases: []});
    t.mock.method(globalThis, 'fetch', async () => Response.json(payload));
    assert.deepEqual(await client().listAnime({}), {releases: [], limit: 75});
    payload = list({releases: ['english', 'non-english', 'raw', 'music-video'].map((category, index) =>
        release({id: `nyaa:${index + 1}`, category}))});
    assert.deepEqual((await client().listAnime({category: 'all'})).releases.map(item => item.category),
        ['english', 'non-english', 'raw', 'music-video']);
});

test('Anime shares concurrent requests while explicit refresh, category and search changes fetch new metadata', async t => {
    const requests = [];
    const operations = [];
    t.mock.method(globalThis, 'fetch', async url => {
        requests.push(url);
        return Response.json(list());
    });
    const {WebCatalogClient} = loadTypeScript('data/datasources/WebCatalogClient.ts');
    const api = new WebCatalogClient({
        start(operation) { operations.push(operation); return {finish() {}, fail() {}}; }, event() {},
    });
    const params = {query: 'sample', category: 'english'};
    const [first, second] = await Promise.all([api.listAnime(params), api.listAnime(params)]);
    assert.equal(first, second);
    assert.equal(requests.length, 1);
    await api.listAnime(params);
    assert.equal(requests.length, 2);
    await api.listAnime({...params, category: 'raw'});
    await api.listAnime({...params, query: 'another'});
    assert.equal(new Set(requests).size, 3);
    assert.equal(requests.length, 4);
    assert.ok(operations.length > 0);
    assert.ok(operations.every(operation => operation === 'api.catalog.anime'));
});

test('Anime subscriber responses remain network-visible without consuming or caching raw content', async t => {
    const requests = [];
    t.mock.method(globalThis, 'fetch', async (url, options) => {
        requests.push({url, options});
        const metadata = list();
        const envelope = {metadata};
        Object.defineProperty(envelope, 'raw', {enumerable: true, get() { assert.fail('Client consumed raw feed'); }});
        return {ok: true, status: 200, json: async () => url.includes('/subscriber-catalog/') ? envelope : metadata};
    });
    const api = repositories();
    await api.anime.listAnime({category: 'raw'});
    await api.anime.listAnime({category: 'raw'});
    api.signOut();
    const metadata = await api.anime.listAnime({category: 'raw'});
    assert.deepEqual(requests.map(request => request.url), [
        `${subscriberBase}/anime?category=raw&v=2`, `${subscriberBase}/anime?category=raw&v=2`,
        `${publicBase}/anime?category=raw&v=2`,
    ]);
    for (const {options} of requests.slice(0, 2)) {
        assert.equal(options.headers.Authorization, 'Bearer anime-account-token');
        assert.equal(options.cache, 'no-store');
        assert.equal(options.redirect, 'error');
    }
    assert.equal(requests[2].options.headers.Authorization, undefined);
    assert.doesNotMatch(JSON.stringify(metadata), /"raw"|infoHash|magnet|\.torrent/);
});

test('Anime subscription denial falls back to public metadata with existing access backoff', async t => {
    const requests = [];
    t.mock.method(globalThis, 'fetch', async url => {
        requests.push(url);
        return url.includes('/subscriber-catalog/')
            ? Response.json({error: 'An active subscription is required'}, {status: 403})
            : Response.json(list());
    });
    const api = repositories();
    assert.equal((await api.anime.listAnime({})).releases.length, 1);
    assert.equal((await api.anime.listAnime({})).releases.length, 1);
    assert.deepEqual(requests, [`${subscriberBase}/anime?v=2`, `${publicBase}/anime?v=2`, `${publicBase}/anime?v=2`]);
});

test('native Anime uses the canonical catalog and shared server authorization regardless of window origin', async t => {
    setGlobal(t, 'window', {location: new URL('http://localhost:8081/')});
    const requests = [];
    t.mock.method(globalThis, 'fetch', async (url, options) => {
        requests.push({url, options});
        return Response.json({metadata: list(), raw: {responses: ['<rss>upstream response</rss>']}});
    });
    const api = repositories(true);
    assert.equal((await api.anime.listAnime({query: 'sample'})).releases[0].id, 'nyaa:123');
    assert.equal(requests[0].url, `${subscriberBase}/anime?query=sample&v=2`);
    assert.equal(requests[0].options.headers.Authorization, 'Bearer anime-account-token');
});

test('the real Anime handler projection and client agree without leaking source fields', async t => {
    const {createCatalogHandler} = loadTypeScript('data/server/catalog/handler.ts');
    const params = [];
    const responses = [];
    const handle = createCatalogHandler({movies: {}, shows: {}, anime: {
        async listAnime(value) {
            params.push(value);
            return list({releases: [release({
                uploadedAt: new Date(uploadedAt),
                title: 'Sample upload https://feed.example/download/123.torrent',
                infoHash: 'a'.repeat(40), url: 'https://feed.example/download/123.torrent',
                description: '<a href="https://feed.example">Private HTML</a>',
            })]});
        },
    }});
    t.mock.method(globalThis, 'fetch', async url => {
        const response = await handle(new Request(url), 'anime');
        responses.push({body: await response.clone().text(), cache: response.headers.get('Cache-Control')});
        return response;
    });
    const result = await client().listAnime({query: 'sample', category: 'english'});
    assert.equal(result.releases[0].id, 'nyaa:123');
    assert.equal(result.releases[0].title, 'Sample upload');
    assert.equal(result.releases[0].uploadedAt.toISOString(), uploadedAt);
    assert.equal(result.limit, 75);
    assert.deepEqual(params, [{query: 'sample', category: 'english'}]);
    assert.equal(responses[0].cache, 'no-store');
    assert.doesNotMatch(responses[0].body, /infoHash|feed\.example|\.torrent|description|"url"/);
});

test('already cancelled Anime requests never start public or subscriber transport', async t => {
    const controller = new AbortController();
    controller.abort('Untrusted cancellation reason');
    t.mock.method(globalThis, 'fetch', async () => assert.fail('Cancelled request reached the network'));
    for (const api of [client(), repositories().anime, repositories(true).anime]) {
        await assert.rejects(api.listAnime({}, controller.signal), error =>
            error.name === 'AbortError' && error.message === 'The catalog request was cancelled.');
    }
});

test('cancelling public Anime during a network failure stops retries and records cancellation', async t => {
    const controller = new AbortController();
    const diagnostics = [];
    let requests = 0;
    t.mock.method(globalThis, 'fetch', async (_url, options) => {
        requests++;
        return new Promise((_resolve, reject) => options.signal.addEventListener('abort', () =>
            reject(new TypeError('Failed to fetch')), {once: true}));
    });
    const {WebCatalogClient} = loadTypeScript('data/datasources/WebCatalogClient.ts');
    const api = new WebCatalogClient({
        start() { return {finish: (...args) => diagnostics.push(args), fail() { assert.fail('Cancellation logged as failure'); }}; },
        event() {},
    });
    const request = api.listAnime({}, controller.signal);
    const rejected = assert.rejects(request, error => error.name === 'AbortError');
    controller.abort();
    await rejected;
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(requests, 1);
    assert.equal(diagnostics[0][0], 'cancelled');
    assert.equal(diagnostics[0][1].error_code, 'request_cancelled');
    assert.equal(diagnostics[0][1].retry_count, 0);
});

test('cancelling public Anime during body parsing prevents decoding retries', async t => {
    const controller = new AbortController();
    let rejectBody;
    let startedBody;
    const bodyStarted = new Promise(resolve => { startedBody = resolve; });
    let requests = 0;
    let transportSignal;
    t.mock.method(globalThis, 'fetch', async (_url, options) => {
        requests++;
        transportSignal = options.signal;
        return {ok: true, status: 200, json() {
            startedBody();
            return new Promise((_resolve, reject) => { rejectBody = reject; });
        }};
    });
    const rejected = assert.rejects(client().listAnime({}, controller.signal), error => error.name === 'AbortError');
    await bodyStarted;
    controller.abort();
    await rejected;
    rejectBody(new SyntaxError('Incomplete JSON body'));
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(transportSignal.aborted, true);
    assert.equal(requests, 1);
});

test('separate Anime signal scopes cannot cancel or reuse another request', async t => {
    const firstController = new AbortController();
    const secondController = new AbortController();
    const pending = [];
    t.mock.method(globalThis, 'fetch', async (_url, options) => {
        let resolve;
        const payload = new Promise(finish => { resolve = finish; });
        pending.push({signal: options.signal, resolve});
        return {ok: true, status: 200, json: () => payload};
    });
    const api = client();
    const first = api.listAnime({query: 'same'}, firstController.signal);
    const rejected = assert.rejects(first, error => error.name === 'AbortError');
    const second = api.listAnime({query: 'same'}, secondController.signal);
    assert.equal(pending.length, 2);
    firstController.abort();
    await rejected;
    assert.equal(pending[0].signal.aborted, true);
    assert.equal(pending[1].signal.aborted, false);
    pending[0].resolve(list());
    pending[1].resolve(list());
    assert.equal((await second).releases[0].id, 'nyaa:123');
});

for (const status of [200, 403]) {
    test(`cancelling Anime while reading a private ${status} body never starts public fallback`, async t => {
        const controller = new AbortController();
        const requests = [];
        let startedBody;
        let finishBody;
        const bodyStarted = new Promise(resolve => { startedBody = resolve; });
        let allowed = false;
        t.mock.method(globalThis, 'fetch', async (url, options) => {
            requests.push({url, options});
            if (allowed) return Response.json({metadata: list(), raw: {responses: []}});
            const read = () => {
                startedBody();
                return new Promise(resolve => { finishBody = resolve; });
            };
            return {ok: status === 200, status, json: read, text: read};
        });
        const api = repositories();
        const rejected = assert.rejects(api.anime.listAnime({}, controller.signal), error => error.name === 'AbortError');
        await bodyStarted;
        controller.abort();
        await rejected;
        finishBody(status === 200 ? {metadata: list()} : 'Denied');
        await new Promise(resolve => setImmediate(resolve));
        assert.equal(requests.length, 1);
        assert.equal(requests[0].options.signal.aborted, true);
        assert.equal(requests[0].url, `${subscriberBase}/anime?v=2`);
        // A cancelled request must not install an authorization-denial backoff.
        allowed = true;
        assert.equal((await api.anime.listAnime({}, new AbortController().signal)).releases.length, 1);
        assert.equal(requests[1].url, `${subscriberBase}/anime?v=2`);
    });
}
