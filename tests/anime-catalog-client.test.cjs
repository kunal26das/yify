const assert = require('node:assert/strict');
const {test} = require('node:test');
const {loadTypeScript} = require('./helpers/load-typescript.cjs');

const base = 'https://yify.expo.app/api/subscriber-catalog';
const uploadedAt = '2026-09-19T03:27:22.000Z';
const release = (patch = {}) => ({id: 'nyaa:123', title: '[Example] Sample anime - 02 [1080p]',
    category: 'english', uploadedAt, size: '320.5 MiB', seeds: 25, peers: 8, downloadCount: 110, ...patch});
const list = (patch = {}) => ({releases: [release()], limit: 75, ...patch});
const envelope = metadata => ({metadata, raw: {responses: []}});

function fixture(options = {}) {
    let account = options.signedOut ? null : {uid: 'anime-account'};
    const listeners = new Set();
    const auth = {
        getSession: () => ({ready: true, account}),
        getIdToken: options.token ?? (async () => 'anime-account-token'),
        subscribe: listener => {listeners.add(listener); return () => listeners.delete(listener);},
    };
    const purchases = {getState: () => ({ready: true, adsRemoved: true, expiresAt: '2099-01-01T00:00:00.000Z'}),
        subscribe: () => () => {}};
    const path = options.native ? 'data/di/catalogRepositories.ts' : 'data/di/catalogRepositories.web.ts';
    const {createCatalogRepositories} = loadTypeScript(path);
    return {...createCatalogRepositories({getApiBaseUrl() {assert.fail('Anime accessed movie provider');}}, undefined, auth, purchases),
        signOut() {account = null; for (const listener of listeners) listener();}};
}

function setGlobal(t, name, value) {
    const descriptor = Object.getOwnPropertyDescriptor(globalThis, name);
    Object.defineProperty(globalThis, name, {configurable: true, writable: true, value});
    t.after(() => descriptor ? Object.defineProperty(globalThis, name, descriptor) : delete globalThis[name]);
}

const deferred = () => {
    let resolve;
    const promise = new Promise(finish => {resolve = finish;});
    return {promise, resolve};
};

test('Anime has no transport without an authenticated account and never uses the public endpoint', async t => {
    t.mock.method(globalThis, 'fetch', async () => assert.fail('Unauthorized Anime request reached transport'));
    const {WebCatalogClient} = loadTypeScript('data/datasources/WebCatalogClient.ts');
    for (const api of [new WebCatalogClient(), fixture({signedOut: true}).anime, fixture({native: true, signedOut: true}).anime]) {
        await assert.rejects(api.listAnime({}), /active subscription/i);
    }
});

test('Anime projects search parameters and validated subscriber metadata with namespaced upload IDs', async t => {
    const requests = [];
    t.mock.method(globalThis, 'fetch', async (url, options) => {
        requests.push({url: new URL(url), options});
        return Response.json(envelope(list({releases: [release({futureField: 'ignored'})]})));
    });
    const result = await fixture().anime.listAnime({query: 'space & stars', category: 'english', page: 2, url: 'https://outside.invalid'});
    assert.deepEqual(result, {releases: [{...release(), uploadedAt: new Date(uploadedAt)}], limit: 75});
    assert.equal(requests[0].url.pathname, '/api/subscriber-catalog/anime');
    assert.deepEqual(Object.fromEntries(requests[0].url.searchParams), {query: 'space & stars', category: 'english', v: '2'});
    assert.equal(requests[0].options.headers.Authorization, 'Bearer anime-account-token');
    assert.equal(requests[0].options.cache, 'no-store');
    assert.equal(requests[0].options.credentials, 'omit');
    assert.equal(requests[0].options.redirect, 'error');
});

test('Anime rejects malformed identities, categories, dates, counters, limits and leaked raw metadata', async t => {
    let payload;
    let calls = 0;
    t.mock.method(globalThis, 'fetch', async () => {calls++; return Response.json(envelope(payload));});
    const invalidReleases = [{id: 123}, {id: 'movie:123'}, {id: 'nyaa:0'}, {id: 'nyaa:001'}, {id: 'nyaa:1.5'},
        {id: 'nyaa:9007199254740992'}, {category: 'all'}, {category: 'unknown'}, {title: ''}, {title: '   '},
        {title: 'x'.repeat(501)}, {title: 'Title\u0000suffix'}, {size: ''}, {size: 'x'.repeat(41)},
        {uploadedAt: 'bad date'}, {uploadedAt: '2026-02-30T03:27:22.000Z'}, {seeds: -1}, {peers: '8'},
        {downloadCount: 1.5}, {downloadCount: Number.MAX_SAFE_INTEGER + 1}, {infoHash: 'a'.repeat(40)},
        {url: 'https://feed.invalid/123.torrent'}, {extra: {magnet_url: 'magnet:?xt=urn:btih:example'}},
        {title: 'Watch magnet:?xt=urn:btih:example'}];
    const invalid = [...invalidReleases.map(patch => list({releases: [release(patch)]})),
        list({limit: 0}), list({limit: 101}), list({limit: '75'}), list({releases: null}),
        list({releases: [release(), release()]}), list({raw: {responses: ['private feed']}}),
        list({releases: Array.from({length: 76}, (_, index) => release({id: `nyaa:${index + 1}`}))})];
    const api = fixture().anime;
    for (payload of invalid) await assert.rejects(api.listAnime({}), /catalog is unavailable/i);
    payload = list();
    assert.equal((await api.listAnime({})).releases[0].id, 'nyaa:123');
    assert.equal(calls, invalid.length + 1);
});

test('Anime accepts empty feeds and each supported release category', async t => {
    let payload = list({releases: []});
    t.mock.method(globalThis, 'fetch', async () => Response.json(envelope(payload)));
    const api = fixture().anime;
    assert.deepEqual(await api.listAnime({}), {releases: [], limit: 75});
    payload = list({releases: ['english', 'non-english', 'raw', 'music-video'].map((category, index) => release({id: `nyaa:${index + 1}`, category}))});
    assert.equal((await api.listAnime({})).releases.length, 4);
});

test('subscriber Anime refreshes remain network-visible without consuming raw records', async t => {
    const requests = [];
    t.mock.method(globalThis, 'fetch', async url => {
        requests.push(url);
        const payload = {metadata: list()};
        Object.defineProperty(payload, 'raw', {get() {assert.fail('Client read raw feed');}});
        return {ok: true, status: 200, json: async () => payload};
    });
    const api = fixture();
    await api.anime.listAnime({category: 'raw'});
    await api.anime.listAnime({category: 'raw'});
    api.signOut();
    await assert.rejects(api.anime.listAnime({category: 'raw'}), /active subscription/i);
    assert.deepEqual(requests, Array(2).fill(`${base}/anime?category=raw&v=2`));
});

for (const status of [401, 403, 429, 503, 502]) {
    test(`subscriber Anime ${status} cannot fall back to public metadata`, async t => {
        const requests = [];
        t.mock.method(globalThis, 'fetch', async url => {
            requests.push(url);
            return Response.json({error: 'PRIVATE_DETAIL'}, {status});
        });
        const api = fixture();
        await assert.rejects(api.anime.listAnime({}), error => !error.message.includes('PRIVATE_DETAIL'));
        assert.deepEqual(requests, [`${base}/anime?v=2`]);
        if (status === 401 || status === 403) assert.equal(api.subscriberAccess.getState(), 'denied');
        if (status === 503) assert.equal(api.subscriberAccess.getState(), 'unavailable');
    });
}

test('native uses canonical production access and Anime endpoints even with a local window origin', async t => {
    setGlobal(t, 'window', {location: new URL('http://localhost:8081/')});
    const requests = [];
    t.mock.method(globalThis, 'fetch', async url => {
        requests.push(url);
        return Response.json(envelope(url.includes('/access?') ? {allowed: true} : list()));
    });
    const api = fixture({native: true});
    await api.subscriberAccess.refresh();
    await api.anime.listAnime({query: 'sample'});
    assert.deepEqual(requests, [`${base}/access?v=2`, `${base}/anime?query=sample&v=2`]);
});

test('web access checks follow preview origin while Pages uses the canonical origin', async t => {
    const requests = [];
    t.mock.method(globalThis, 'fetch', async url => {requests.push(url); return Response.json(envelope({allowed: true}));});
    setGlobal(t, 'window', {location: new URL('https://yify--preview.expo.app')});
    for (const origin of ['https://yify--preview.expo.app', 'https://kunal26das.github.io']) {
        window.location = new URL(origin);
        await fixture().subscriberAccess.refresh();
    }
    assert.deepEqual(requests, ['https://yify--preview.expo.app/api/subscriber-catalog/access?v=2', `${base}/access?v=2`]);
});

test('real authorized Anime handler and client agree while projecting away source fields', async t => {
    const {createCatalogHandler} = loadTypeScript('data/server/catalog/handler.ts');
    let authorized = false;
    const handler = createCatalogHandler(() => {
        assert.equal(authorized, true);
        return {movies: {}, shows: {}, anime: {async listAnime() {
            return list({releases: [release({uploadedAt: new Date(uploadedAt), infoHash: 'a'.repeat(40),
                title: 'Sample https://feed.invalid/123.torrent'})]});
        }}};
    }, {subscriber: {authorize: async () => {authorized = true; return {uid: 'approved'};}}});
    t.mock.method(globalThis, 'fetch', async (url, options) => handler(new Request(url, options), 'anime'));
    const result = await fixture().anime.listAnime({});
    assert.equal(result.releases[0].title, 'Sample');
    assert.equal(result.releases[0].uploadedAt.toISOString(), uploadedAt);
    assert.doesNotMatch(JSON.stringify(result), /feed\.invalid|infoHash|\.torrent/);
});

test('already-cancelled Anime never fetches and separate signal scopes remain independent', async t => {
    const before = new AbortController(); before.abort();
    const pending = [];
    t.mock.method(globalThis, 'fetch', async (_url, options) => {
        const body = deferred(); pending.push({body, signal: options.signal});
        return {ok: true, status: 200, json: () => body.promise};
    });
    const api = fixture().anime;
    await assert.rejects(api.listAnime({}, before.signal), {name: 'AbortError'});
    assert.equal(pending.length, 0);
    const first = new AbortController(), second = new AbortController();
    const rejected = assert.rejects(api.listAnime({}, first.signal), {name: 'AbortError'});
    const successful = api.listAnime({}, second.signal);
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(pending.length, 2);
    first.abort(); await rejected;
    assert.equal(pending[0].signal.aborted, true);
    assert.equal(pending[1].signal.aborted, false);
    pending[0].body.resolve(envelope(list())); pending[1].body.resolve(envelope(list()));
    assert.equal((await successful).releases.length, 1);
});

for (const status of [200, 403]) {
    test(`cancelling a private Anime ${status} body prevents all fallback`, async t => {
        const controller = new AbortController();
        const started = deferred(), body = deferred();
        const requests = [];
        t.mock.method(globalThis, 'fetch', async url => {
            requests.push(url);
            const read = () => {started.resolve(); return body.promise;};
            return {ok: status === 200, status, json: read, text: read};
        });
        const rejected = assert.rejects(fixture().anime.listAnime({}, controller.signal), {name: 'AbortError'});
        await started.promise; controller.abort(); await rejected;
        body.resolve(status === 200 ? envelope(list()) : 'Denied');
        assert.deepEqual(requests, [`${base}/anime?v=2`]);
    });
}
