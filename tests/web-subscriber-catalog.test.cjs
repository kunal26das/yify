const assert = require('node:assert/strict');
const {test} = require('node:test');
const {loadTypeScript} = require('./helpers/load-typescript.cjs');

const publicBase = 'https://yify.expo.app/api/catalog';
const privateBase = 'https://yify.expo.app/api/subscriber-catalog';
const cover = 'https://images.example/cover.jpg';
const future = '2099-01-01T00:00:00.000Z';

function movie(title = 'Metadata') {
    return {id: 42, imdbCode: 'tt0000042', title, titleLong: `${title} (2026)`, year: 2026,
        rating: 8, runtimeMinutes: 90, genres: ['Drama'], summary: 'A story.', language: 'en',
        mpaRating: 'PG', posterUrls: [cover], ytTrailerCode: 'abcdefghijk'};
}

function details(title) {
    return {...movie(title), descriptionFull: 'Description', synopsis: 'Synopsis',
        screenshotUrls: [], screenshotThumbUrls: [], cast: []};
}

function list(title) {
    return {movies: [movie(title)], pageNumber: 1, movieCount: 1, hasMore: false};
}

function envelope(metadata) {
    return {metadata, raw: {responses: [{data: {movies: [{torrents: [{
        hash: 'private-upstream-hash', url: 'https://upstream.example/file.torrent',
        magnetUrl: 'magnet:?xt=urn:btih:private', seeds: 10,
    }]}]}}]}};
}

function response(payload, status = 200) {
    return {ok: status >= 200 && status < 300, status, json: async () => payload};
}

function deferred() {
    let resolve;
    let reject;
    const promise = new Promise((res, rej) => { resolve = res; reject = rej; });
    return {promise, resolve, reject};
}

function fixture(options = {}) {
    let session = {ready: true, account: {uid: 'account-a'}, ...options.session};
    let state = {ready: true, adsRemoved: true, expiresAt: future, ...options.state};
    const authListeners = new Set();
    const purchaseListeners = new Set();
    const diagnostics = [];
    let tokenRequests = 0;
    const auth = {
        getSession: () => session,
        subscribe: listener => { authListeners.add(listener); return () => authListeners.delete(listener); },
        getIdToken: async () => {
            tokenRequests++;
            return options.token ? options.token() : `token-for-${session.account?.uid}`;
        },
    };
    const purchases = {
        getState: () => state,
        subscribe: listener => { purchaseListeners.add(listener); return () => purchaseListeners.delete(listener); },
    };
    const {createCatalogRepositories} = loadTypeScript('data/di/catalogRepositories.web.ts');
    const repositories = createCatalogRepositories({getApiBaseUrl() { assert.fail('raw provider configuration'); }}, {
        start: (...args) => {
            diagnostics.push(args);
            return {
                finish: (...args) => diagnostics.push(args),
                fail: (...args) => diagnostics.push(args),
            };
        },
        event: (...args) => diagnostics.push(args),
    }, auth, purchases);
    return {
        ...repositories, diagnostics, tokenRequests: () => tokenRequests,
        session: patch => {
            session = {...session, ...patch};
            for (const listener of authListeners) listener();
        },
        state: patch => {
            state = {...state, ...patch};
            for (const listener of purchaseListeners) listener();
        },
    };
}

test('only a signed-in ready account with a ready ad-removal hint attempts subscriber transport', async t => {
    const requests = [];
    t.mock.method(globalThis, 'fetch', async (url, options) => {
        requests.push({url, options});
        return response(list());
    });
    for (const options of [
        {session: {ready: false}}, {session: {account: null}}, {state: {ready: false}},
        {state: {adsRemoved: false}},
    ]) {
        const f = fixture(options);
        assert.equal((await f.movies.listMovies({page: 1})).movies[0].title, 'Metadata');
        assert.equal(f.tokenRequests(), 0);
    }
    assert.ok(requests.every(request => request.url === `${publicBase}/movies?page=1` &&
        request.options.headers.Authorization === undefined));
});

test('lifetime, expired and ambiguous expiry hints require server approval and fall back on 403', async t => {
    const requests = [];
    t.mock.method(globalThis, 'fetch', async (url, options) => {
        requests.push({url, options});
        return url.startsWith(privateBase)
            ? {ok: false, status: 403, json: async () => assert.fail('denied subscriber body parsed')}
            : response(details('Public metadata'));
    });
    for (const expiresAt of [null, '2000-01-01T00:00:00Z', 'invalid', undefined]) {
        const f = fixture({state: {expiresAt}});
        assert.equal((await f.movies.getMovieDetails(42)).title, 'Public metadata');
        assert.equal(f.tokenRequests(), 1);
    }
    assert.deepEqual(requests.map(request => request.url), Array(4).fill([
        `${privateBase}/movie?id=42`, `${publicBase}/movie?id=42`,
    ]).flat());
    assert.ok(requests.filter(request => request.url.startsWith(privateBase)).every(request =>
        request.options.headers.Authorization === 'Bearer token-for-account-a'));
});

test('server-approved grace periods and combined purchase hints return validated metadata despite expiry ambiguity', async t => {
    const requests = [];
    t.mock.method(globalThis, 'fetch', async url => {
        requests.push(url);
        return response(envelope(details('Server-approved metadata')));
    });
    for (const state of [{expiresAt: '2000-01-01T00:00:00Z', billingIssue: true}, {expiresAt: null}]) {
        const f = fixture({state});
        const value = await f.movies.getMovieDetails(42);
        assert.equal(value.title, 'Server-approved metadata');
        assert.deepEqual(value.torrents, []);
        assert.doesNotMatch(JSON.stringify(value), /private-upstream|upstream\.example|urn:btih|"raw"/);
    }
    assert.deepEqual(requests, Array(2).fill(`${privateBase}/movie?id=42`));
});

test('subscriber transport covers all endpoints while returning only validated domain metadata', async t => {
    const date = '2026-09-11T05:00:00.000Z';
    const episode = {id: 12, title: 'Episode', season: 1, episode: 2, releasedAt: date};
    const show = {imdbId: '1234567', imdbCode: 'tt1234567', title: 'Series', episodeCount: 1,
        latestEpisode: episode, updatedAt: date};
    const payloads = {
        movies: list(), movie: details(), suggestions: [movie()],
        'parental-guides': [{type: 'violence', text: 'Mild action.'}],
        shows: {shows: [show], pageNumber: 1, hasMore: false}, episodes: [episode],
    };
    const requests = [];
    t.mock.method(globalThis, 'fetch', async (url, options) => {
        requests.push({url: new URL(url), options});
        return response(envelope(payloads[new URL(url).pathname.split('/').at(-1)]));
    });
    const f = fixture();
    const listed = await f.movies.listMovies({page: 1, query: 'a & b', limit: 20, quality: '1080p',
        minimum_rating: 5, genre: 'drama', sort_by: 'rating', order_by: 'desc', token: 'ignored'});
    const detail = await f.movies.getMovieDetails(42);
    const suggestions = await f.movies.getMovieSuggestions(42);
    const guides = await f.movies.getMovieParentalGuides(42);
    const shows = await f.shows.listShows({page: 1, limit: 20, imdbId: '1234567'});
    const episodes = await f.shows.listEpisodes('1234567');
    assert.deepEqual(detail.torrents, []);
    assert.equal(Object.hasOwn(detail, 'downloadCount'), false);
    assert.equal(episodes[0].magnetUrl, '');
    assert.equal(episodes[0].seeds, 0);
    assert.equal(episodes[0].releasedAt.toISOString(), date);
    assert.equal(shows.shows[0].updatedAt.toISOString(), date);
    assert.deepEqual(requests.map(request => request.url.pathname),
        Object.keys(payloads).map(endpoint => `/api/subscriber-catalog/${endpoint}`));
    assert.deepEqual(Object.fromEntries(requests[0].url.searchParams), {page: '1', limit: '20', query: 'a & b',
        quality: '1080p', minimum_rating: '5', genre: 'drama', sort_by: 'rating', order_by: 'desc'});
    assert.ok(requests.every(request => request.options.headers.Authorization === 'Bearer token-for-account-a' &&
        request.options.cache === 'no-store' && request.options.redirect === 'error' &&
        request.options.credentials === 'omit' && request.options.signal instanceof AbortSignal));
    assert.doesNotMatch(JSON.stringify([listed, detail, suggestions, guides, shows, episodes, f.diagnostics]),
        /private-upstream|upstream\.example|token-for|urn:btih|"raw"/);
});

test('subscriber responses never enter the public cache or suppress future private network requests', async t => {
    const paths = [];
    t.mock.method(globalThis, 'fetch', async url => {
        paths.push(url);
        return response(url.startsWith(privateBase) ? envelope(details('Subscriber metadata')) : details('Public metadata'));
    });
    const f = fixture({state: {adsRemoved: false}});
    assert.equal((await f.movies.getMovieDetails(42)).title, 'Public metadata');
    f.state({adsRemoved: true});
    assert.equal((await f.movies.getMovieDetails(42)).title, 'Subscriber metadata');
    assert.equal((await f.movies.getMovieDetails(42)).title, 'Subscriber metadata');
    f.session({account: null});
    assert.equal((await f.movies.getMovieDetails(42)).title, 'Public metadata');
    assert.deepEqual(paths, [`${publicBase}/movie?id=42`, `${privateBase}/movie?id=42`, `${privateBase}/movie?id=42`]);
});

for (const status of [401, 403, 503]) {
    test(`${status} falls back to public metadata with bounded access retry and no error-body parsing`, async t => {
        let now = 1_000;
        t.mock.method(Date, 'now', () => now);
        const paths = [];
        t.mock.method(globalThis, 'fetch', async url => {
            paths.push(url);
            return url.startsWith(privateBase)
                ? {ok: false, status, json: async () => assert.fail('private error body parsed')}
                : response(details());
        });
        const f = fixture();
        await f.movies.getMovieDetails(42);
        await f.movies.getMovieDetails(42);
        assert.deepEqual(paths, [`${privateBase}/movie?id=42`, `${publicBase}/movie?id=42`]);
        now += 30_000;
        await f.movies.getMovieDetails(42);
        assert.equal(paths.filter(url => url.startsWith(privateBase)).length, 2);
        f.state({expiresAt: '2098-01-01T00:00:00.000Z'});
        await f.movies.getMovieDetails(42);
        assert.equal(paths.filter(url => url.startsWith(privateBase)).length, 3);
        f.session({account: {uid: 'account-b'}});
        await f.movies.getMovieDetails(42);
        assert.equal(paths.filter(url => url.startsWith(privateBase)).length, 4);
    });
}

test('failed or missing Firebase tokens fall back without sending an Authorization header', async t => {
    const requests = [];
    t.mock.method(globalThis, 'fetch', async (url, options) => {
        requests.push({url, options});
        return response(details());
    });
    for (const token of [async () => null, async () => { throw new Error('private token failure'); }]) {
        const f = fixture({token});
        assert.equal((await f.movies.getMovieDetails(42)).id, 42);
        assert.doesNotMatch(JSON.stringify(f.diagnostics), /private token failure/);
    }
    assert.ok(requests.every(request => request.url.startsWith(publicBase) &&
        request.options.headers.Authorization === undefined));
});

test('an account round trip while acquiring its token cancels the stale grant', async t => {
    const token = deferred();
    const paths = [];
    t.mock.method(globalThis, 'fetch', async url => { paths.push(url); return response(details('Public metadata')); });
    const f = fixture({token: () => token.promise});
    const pending = f.movies.getMovieDetails(42);
    f.session({account: {uid: 'account-b'}});
    f.session({account: {uid: 'account-a'}});
    token.resolve('stale-account-a-token');
    assert.equal((await pending).title, 'Public metadata');
    assert.deepEqual(paths, [`${publicBase}/movie?id=42`]);
});

test('sign-out aborts an in-flight subscriber fetch and falls back without awaiting its body', async t => {
    const fetched = deferred();
    const privateRequest = deferred();
    const paths = [];
    t.mock.method(globalThis, 'fetch', async (url, options) => {
        paths.push(url);
        if (url.startsWith(publicBase)) return response(details('Public metadata'));
        fetched.resolve(options.signal);
        return privateRequest.promise;
    });
    const f = fixture();
    const pending = f.movies.getMovieDetails(42);
    const signal = await fetched.promise;
    f.session({account: null});
    assert.equal(signal.aborted, true);
    assert.equal((await pending).title, 'Public metadata');
    privateRequest.resolve({ok: true, status: 200, json: () => assert.fail('retired request body consumed')});
    assert.deepEqual(paths, [`${privateBase}/movie?id=42`, `${publicBase}/movie?id=42`]);
});

test('identity changes during body parsing discard old metadata and permit a fresh account request', async t => {
    const started = deferred();
    const body = deferred();
    const requests = [];
    let privateCalls = 0;
    t.mock.method(globalThis, 'fetch', async (url, options) => {
        requests.push({url, options});
        if (url.startsWith(publicBase)) return response(details('Public metadata'));
        if (++privateCalls > 1) return response(envelope(details('Account B metadata')));
        return {ok: true, status: 200, json: () => { started.resolve(); return body.promise; }};
    });
    const f = fixture();
    const pending = f.movies.getMovieDetails(42);
    await started.promise;
    f.session({account: {uid: 'account-b'}});
    body.resolve(envelope(details('Stale account A metadata')));
    assert.equal((await pending).title, 'Public metadata');
    assert.equal((await f.movies.getMovieDetails(42)).title, 'Account B metadata');
    assert.equal(requests[0].options.signal.aborted, true);
    assert.equal(requests[2].options.headers.Authorization, 'Bearer token-for-account-b');
});

test('subscription revocation aborts and prevents private access even while the account is unchanged', async t => {
    const fetched = deferred();
    const paths = [];
    t.mock.method(globalThis, 'fetch', async (url, options) => {
        paths.push(url);
        if (url.startsWith(publicBase)) return response(details());
        fetched.resolve(options.signal);
        return new Promise(() => {});
    });
    const f = fixture();
    const pending = f.movies.getMovieDetails(42);
    const signal = await fetched.promise;
    f.state({adsRemoved: false});
    assert.equal(signal.aborted, true);
    assert.equal((await pending).id, 42);
    await f.movies.getMovieDetails(42);
    assert.equal(paths.filter(url => url.startsWith(privateBase)).length, 1);
});

test('an expiry change cancels the old generation and requires a fresh server decision', async t => {
    const fetched = deferred();
    const requests = [];
    let privateCalls = 0;
    t.mock.method(globalThis, 'fetch', async (url, options) => {
        requests.push(url);
        if (url.startsWith(publicBase)) return response(details('Public metadata'));
        if (++privateCalls > 1) return {ok: false, status: 403};
        fetched.resolve(options.signal);
        return new Promise(() => {});
    });
    const f = fixture();
    const pending = f.movies.getMovieDetails(42);
    const signal = await fetched.promise;
    f.state({expiresAt: null});
    assert.equal(signal.aborted, true);
    assert.equal((await pending).title, 'Public metadata');
    assert.equal((await f.movies.getMovieDetails(42)).title, 'Public metadata');
    assert.deepEqual(requests, [`${privateBase}/movie?id=42`, `${publicBase}/movie?id=42`, `${privateBase}/movie?id=42`]);
});

test('private parsing ignores the raw property entirely but rejects protected or invalid metadata', async t => {
    let payload = {metadata: details()};
    Object.defineProperty(payload, 'raw', {enumerable: true, get() { assert.fail('raw response inspected'); }});
    const paths = [];
    t.mock.method(globalThis, 'fetch', async url => { paths.push(url); return response(payload); });
    const f = fixture();
    assert.equal((await f.movies.getMovieDetails(42)).id, 42);
    for (payload of [
        envelope({...details(), torrents: []}), envelope({...details(), extra: {hash: 'private'}}),
        envelope({...details(), synopsis: 'magnet:?xt=urn:btih:private'}),
        envelope({...details(), id: '42'}), {raw: {responses: []}}, null, [],
    ]) {
        await assert.rejects(f.movies.getMovieDetails(42), error =>
            error.message === 'The catalog is unavailable. Please try again.');
    }
    assert.ok(paths.every(url => url.startsWith(privateBase)));
    assert.doesNotMatch(JSON.stringify(f.diagnostics), /private|magnet|token/);
});

test('public responses still reject a subscriber envelope rather than extracting its metadata', async t => {
    t.mock.method(globalThis, 'fetch', async () => response(envelope(details())));
    const f = fixture({state: {adsRemoved: false}});
    await assert.rejects(f.movies.getMovieDetails(42), /catalog is unavailable/i);
});

test('subscriber transport failures stay generic without falling back to raw origins or bypassing 429', async t => {
    const paths = [];
    for (const reply of [
        async () => ({ok: false, status: 429, json: async () => assert.fail('error body parsed')}),
        async () => { throw new Error('private upstream address or token'); },
        async () => ({ok: true, status: 200, json: async () => { throw new Error('private raw response'); }}),
    ]) {
        t.mock.method(globalThis, 'fetch', async url => { paths.push(url); return reply(); });
        const f = fixture();
        await assert.rejects(f.movies.getMovieDetails(42), error =>
            error.message === 'The catalog is unavailable. Please try again.');
        assert.doesNotMatch(JSON.stringify(f.diagnostics), /private|token/);
    }
    assert.deepEqual(paths, Array(3).fill(`${privateBase}/movie?id=42`));
});

test('a stalled private request times out, aborts, and can be retried without a retained response', async t => {
    t.mock.timers.enable({apis: ['setTimeout']});
    const started = deferred();
    let calls = 0;
    t.mock.method(globalThis, 'fetch', async (_url, options) => {
        if (++calls > 1) return response(envelope(details()));
        started.resolve(options.signal);
        return new Promise(() => {});
    });
    const f = fixture();
    const failed = assert.rejects(f.movies.getMovieDetails(42), /catalog request timed out/i);
    const signal = await started.promise;
    t.mock.timers.tick(30_000);
    await failed;
    assert.equal(signal.aborted, true);
    assert.equal((await f.movies.getMovieDetails(42)).id, 42);
    assert.equal(calls, 2);
});

test('a stalled token lookup is bounded and falls back to public browsing', async t => {
    t.mock.timers.enable({apis: ['setTimeout']});
    const paths = [];
    t.mock.method(globalThis, 'fetch', async url => { paths.push(url); return response(details()); });
    const f = fixture({token: () => new Promise(() => {})});
    const pending = f.movies.getMovieDetails(42);
    t.mock.timers.tick(30_000);
    assert.equal((await pending).id, 42);
    assert.deepEqual(paths, [`${publicBase}/movie?id=42`]);
});
