const assert = require('node:assert/strict');
const {test} = require('node:test');
const React = require('react');
const {act, create} = require('react-test-renderer');
const {loadTypeScript} = require('./helpers/load-typescript.cjs');

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

function observable(initial) {
    let value = initial;
    const listeners = new Set();
    return {
        get: () => value,
        subscribe: listener => { listeners.add(listener); return () => listeners.delete(listener); },
        set: next => { value = next; for (const listener of listeners) listener(); },
    };
}

function deferred(t) {
    let resolve;
    const promise = new Promise(done => { resolve = done; });
    t.after(() => resolve());
    return {promise, resolve};
}

const cover = 'https://images.example/cover.jpg';
const date = '2026-09-11T00:00:00.000Z';
const movie = {id: 42, imdbCode: 'tt0000042', title: 'Example', titleLong: 'Example (2026)', year: 2026,
    rating: 8, runtimeMinutes: 90, genres: ['Drama'], summary: 'A story.', language: 'en', mpaRating: 'PG',
    posterUrls: [cover], backgroundImageUrl: cover, ytTrailerCode: 'abcdefghijk'};
const episode = {id: 12, title: 'Episode', season: 1, episode: 2, releasedAt: date};
const show = {imdbId: '1234567', imdbCode: 'tt1234567', title: 'Series', episodeCount: 1,
    latestEpisode: episode, updatedAt: date};

function payload(url) {
    switch (url.pathname.split('/').at(-1)) {
        case 'movie': return {...movie, descriptionFull: 'Description', synopsis: 'Synopsis',
            screenshotUrls: [], screenshotThumbUrls: [], cast: []};
        case 'suggestions': return [];
        case 'shows': return {shows: [show], pageNumber: 1, hasMore: false};
        default: return {movies: [movie], pageNumber: Number(url.searchParams.get('page') || 1), movieCount: 1, hasMore: false};
    }
}

async function fixture(t, kind = 'details', options = {}) {
    const session = observable({ready: true, account: null, ...options.session});
    const purchases = observable({ready: false, adsRemoved: false, expiresAt: null, ...options.purchases});
    const focused = observable(options.focused ?? true);
    const requests = [];
    const auth = {getSession: session.get, subscribe: session.subscribe, getIdToken: async () => 'local-test-token'};
    const purchaseRepository = {getState: purchases.get, subscribe: purchases.subscribe};
    t.mock.method(globalThis, 'fetch', async (input, init) => {
        const url = new URL(input);
        const privateRequest = url.pathname.includes('/api/subscriber-catalog/');
        requests.push({url: url.href, private: privateRequest});
        if (!privateRequest) await options.blockPublic?.(url);
        if (privateRequest && options.denied) return {ok: false, status: 403};
        const metadata = payload(url);
        return {ok: true, status: 200, json: async () => privateRequest
            ? {metadata, raw: {responses: [{private: true}]}} : metadata};
    });
    const hook = options.native
        ? loadTypeScript('presentation/hooks/use-reload-on-catalog-access.ts')
        : loadTypeScript('presentation/hooks/use-reload-on-catalog-access.web.ts', {
            'expo-router': {useIsFocused: () => React.useSyncExternalStore(focused.subscribe, focused.get)},
            './use-auth': {useAuth: () => React.useSyncExternalStore(session.subscribe, session.get)},
            './use-purchases': {usePurchases: () => React.useSyncExternalStore(purchases.subscribe, purchases.get)},
        });
    const {createCatalogRepositories} = loadTypeScript('data/di/catalogRepositories.web.ts');
    const repositories = createCatalogRepositories({}, undefined, auth, purchaseRepository);
    const names = {details: 'useMovieDetailsViewModel', movies: 'useMoviesViewModel', home: 'useHomeViewModel',
        feed: 'useFeedViewModel', shows: 'useShowsViewModel'};
    const name = names[kind];
    const module = loadTypeScript(`presentation/movies/${name}.ts`, {
        '../hooks/use-reload-on-catalog-access': hook,
        '@/presentation/analytics/events': {Analytics: {showsImpression() {}, showsUnavailable() {}, loadError() {}}},
    });
    let value;
    function Probe() {
        value = module[name](kind === 'shows' ? repositories.shows : repositories.movies,
            kind === 'details' ? 42 : kind === 'feed' ? {skipHero: options.skipHero ?? true} : undefined);
        const initial = value.loadInitial;
        React.useEffect(() => { initial?.(); }, [initial]);
        return null;
    }
    let renderer;
    await act(async () => {
        const probe = React.createElement(Probe);
        renderer = create(options.strict ? React.createElement(React.StrictMode, null, probe) : probe);
    });
    t.after(async () => { await act(async () => renderer.unmount()); });
    return {
        requests,
        get value() { return value; },
        privateCount: () => requests.filter(request => request.private).length,
        change: async ({auth: nextSession, purchase: nextPurchase, focus} = {}) => {
            await act(async () => {
                if (nextSession) session.set({...session.get(), ...nextSession});
                if (nextPurchase) purchases.set({...purchases.get(), ...nextPurchase});
                if (focus !== undefined) focused.set(focus);
            });
        },
        signIn: async () => {
            await act(async () => {
                session.set({ready: true, account: {uid: 'account-a'}});
                purchases.set({ready: true, adsRemoved: true, expiresAt: null});
            });
        },
    };
}

for (const kind of ['details', 'movies', 'home', 'feed', 'shows']) {
    test(`${kind} reloads its public catalog once when a signed-out visitor becomes a ready subscriber`, async t => {
        const f = await fixture(t, kind);
        assert.ok(f.requests.length > 0);
        assert.equal(f.privateCount(), 0);
        await f.signIn();
        assert.ok(f.privateCount() > 0);
        const completed = f.requests.length;
        await f.change({purchase: {refreshing: true}});
        await f.change({purchase: {refreshing: false}});
        await f.change({focus: false});
        await f.change({focus: true});
        assert.equal(f.requests.length, completed);
    });
}

test('an already-ready subscriber makes only the initial private detail requests', async t => {
    const f = await fixture(t, 'details', {
        session: {ready: true, account: {uid: 'account-a'}},
        purchases: {ready: true, adsRemoved: true},
    });
    assert.equal(f.requests.length, 2);
    assert.equal(f.privateCount(), 2);
    await f.change({purchase: {ready: true, adsRemoved: true}});
    await f.change({auth: {ready: true, account: {uid: 'account-a'}}});
    assert.equal(f.requests.length, 2);
});

test('a ready account change refreshes once for the new identity', async t => {
    const f = await fixture(t, 'details', {
        session: {ready: true, account: {uid: 'account-a'}},
        purchases: {ready: true, adsRemoved: true},
    });
    assert.equal(f.privateCount(), 2);
    await f.change({auth: {account: {uid: 'account-b'}}});
    assert.equal(f.privateCount(), 4);
    await f.change({auth: {account: {uid: 'account-b'}}});
    assert.equal(f.privateCount(), 4);
});

test('StrictMode effect replay does not duplicate the readiness refresh', async t => {
    const f = await fixture(t, 'details', {strict: true});
    assert.equal(f.requests.length, 2);
    assert.equal(f.privateCount(), 0);
    await f.signIn();
    assert.equal(f.privateCount(), 2);
    await f.change({purchase: {refreshing: false}});
    assert.equal(f.requests.length, 4);
});

for (const kind of ['details', 'movies', 'home', 'feed', 'shows']) {
    test(`${kind} queues the readiness refresh until its initial public load settles`, async t => {
        const gate = deferred(t);
        const f = await fixture(t, kind, {session: {ready: false}, blockPublic: () => gate.promise});
        assert.ok(f.requests.length > 0);
        await f.signIn();
        assert.equal(f.privateCount(), 0);
        await act(async () => gate.resolve());
        assert.ok(f.privateCount() > 0);
        const completed = f.requests.length;
        await f.change({purchase: {refreshing: true}});
        assert.equal(f.requests.length, completed);
    });
}

test('Home waits for a running shelf queue before refreshing its catalog', async t => {
    const gate = deferred(t);
    let block = false;
    const f = await fixture(t, 'home', {blockPublic: () => block ? gate.promise : undefined});
    block = true;
    await act(async () => f.value.loadShelf(f.value.shelves[1].key));
    const beforeReady = f.requests.length;
    assert.ok(beforeReady > 1);
    await f.signIn();
    assert.equal(f.privateCount(), 0);
    await act(async () => gate.resolve());
    assert.ok(f.privateCount() > 0);
});

test('Feed waits for its separate hero request even after its page has loaded', async t => {
    const gate = deferred(t);
    let count = 0;
    const f = await fixture(t, 'feed', {skipHero: false, blockPublic: () => ++count === 1 ? gate.promise : undefined});
    assert.equal(f.value.loading, false);
    await f.signIn();
    assert.equal(f.privateCount(), 0);
    await act(async () => gate.resolve());
    assert.equal(f.privateCount(), 2);
});

test('an inactive route waits for focus and consumes the pending readiness refresh once', async t => {
    const f = await fixture(t, 'details', {focused: false});
    await f.signIn();
    assert.equal(f.privateCount(), 0);
    await f.change({focus: true});
    assert.equal(f.privateCount(), 2);
    await f.change({focus: false});
    await f.change({focus: true});
    assert.equal(f.privateCount(), 2);
});

test('sign-out cancels a pending readiness refresh before the public load settles', async t => {
    const gate = deferred(t);
    const f = await fixture(t, 'details', {blockPublic: () => gate.promise});
    await f.signIn();
    await f.change({auth: {account: null}});
    await act(async () => gate.resolve());
    assert.equal(f.privateCount(), 0);
    assert.equal(f.requests.length, 2);
});

test('a denied subscriber attempt falls back without creating a readiness retry loop', async t => {
    const f = await fixture(t, 'details', {denied: true});
    await f.signIn();
    assert.equal(f.privateCount(), 2);
    assert.equal(f.value.details.id, 42);
    const completed = f.requests.length;
    await f.change({purchase: {refreshing: true}});
    await f.change({purchase: {refreshing: false}});
    assert.equal(f.requests.length, completed);
});

test('the native hook preserves existing view-model requests without requiring account context', async t => {
    const f = await fixture(t, 'details', {native: true});
    assert.equal(f.requests.length, 2);
    await f.signIn();
    assert.equal(f.requests.length, 2);
    assert.equal(f.privateCount(), 0);
});
