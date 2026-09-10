const assert = require('node:assert/strict');
const {test} = require('node:test');
const {loadTypeScript} = require('./helpers/load-typescript.cjs');

const base = 'https://yify.expo.app/api/catalog';
const cover = 'https://images.example/cover.jpg';
const date = '2026-09-11T05:00:00.000Z';

function movie() {
    return {id: 42, imdbCode: 'tt0000042', title: 'Example', titleLong: 'Example (2026)',
        year: 2026, rating: 8, runtimeMinutes: 90, genres: ['Drama'], summary: 'A story.',
        language: 'en', mpaRating: 'PG', posterUrls: [cover], backgroundImageUrl: cover,
        ytTrailerCode: 'abcdefghijk', thumbnailUrls: [cover]};
}

function details() {
    return {...movie(), descriptionIntro: 'Introduction', descriptionFull: 'Description',
        synopsis: 'Synopsis', likeCount: 9, screenshotUrls: [cover], screenshotThumbUrls: [cover],
        cast: [{name: 'Actor', character: 'Character', imdbCode: 'nm0000001', imageUrl: cover}]};
}

function episode() {
    return {id: 12, title: 'Episode', season: 1, episode: 2, releasedAt: date, thumbnailUrl: cover};
}

function show() {
    return {imdbId: '1234567', imdbCode: 'tt1234567', title: 'Series', episodeCount: 1,
        latestEpisode: episode(), thumbnailUrl: cover, updatedAt: date};
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

test('catalog origin follows hosted previews and local development but keeps Pages and desktop on production', () => {
    const {webCatalogBaseUrl} = loadTypeScript('data/datasources/WebCatalogClient.ts');
    for (const [href, expected, desktop] of [
        ['https://yify.expo.app/movies', base],
        ['https://yify--preview.expo.app/movies', 'https://yify--preview.expo.app/api/catalog'],
        ['https://kunal26das.github.io/yify/movies', base],
        ['http://localhost:8081/movies', 'http://localhost:8081/api/catalog'],
        ['http://127.0.0.1:8081/movies', 'http://127.0.0.1:8081/api/catalog'],
        ['http://[::1]:8081/movies', 'http://[::1]:8081/api/catalog'],
        ['http://localhost:42131/movies', base, true],
        ['https://yify.expo.app.example/movies', base],
        ['http://yify.expo.app/movies', base],
    ]) {
        assert.equal(webCatalogBaseUrl(new URL(href), desktop ?? false), expected);
    }
    assert.equal(webCatalogBaseUrl(undefined, false), base);
});

test('web factory uses all six metadata endpoints, projects parameters and restores domain-only defaults', async t => {
    const payloads = {
        movies: {movies: [movie()], pageNumber: 2, movieCount: 80, hasMore: true},
        movie: details(), suggestions: [movie()],
        'parental-guides': [{type: 'violence', text: 'Mild action.'}],
        shows: {shows: [show()], pageNumber: 2, hasMore: true}, episodes: [episode()],
    };
    const requests = [];
    t.mock.method(globalThis, 'fetch', async (url, options) => {
        const parsed = new URL(url);
        requests.push({url: parsed, options});
        return {ok: true, status: 200, json: async () => payloads[parsed.pathname.split('/').at(-1)]};
    });
    const {createCatalogRepositories} = loadTypeScript('data/di/catalogRepositories.web.ts');
    const repositories = createCatalogRepositories({getApiBaseUrl() { assert.fail('native URL was accessed'); }});
    const listed = await repositories.movies.listMovies({page: 2, limit: 20, query: 'a & b', quality: '1080p',
        minimum_rating: 5, genre: 'drama', sort_by: 'rating', order_by: 'desc', url: 'https://outside.example'});
    assert.equal(listed.movies[0].title, 'Example');
    assert.deepEqual(Object.fromEntries(requests[0].url.searchParams), {page: '2', limit: '20', query: 'a & b',
        quality: '1080p', minimum_rating: '5', genre: 'drama', sort_by: 'rating', order_by: 'desc'});
    const detail = await repositories.movies.getMovieDetails(42);
    assert.deepEqual(detail.torrents, []);
    assert.equal(Object.hasOwn(detail, 'downloadCount'), false);
    assert.equal(detail.cast[0].name, 'Actor');
    assert.equal((await repositories.movies.getMovieSuggestions(42))[0].id, 42);
    assert.deepEqual(await repositories.movies.getMovieParentalGuides(42), payloads['parental-guides']);
    const shows = await repositories.shows.listShows({page: 2, limit: 50, imdbId: '1234567'});
    const episodes = await repositories.shows.listEpisodes('1234567');
    assert.equal(shows.shows[0].updatedAt.toISOString(), date);
    assert.equal(shows.shows[0].latestEpisode.releasedAt.toISOString(), date);
    assert.equal(episodes[0].releasedAt.toISOString(), date);
    assert.equal(episodes[0].magnetUrl, '');
    assert.equal(episodes[0].seeds, 0);
    assert.equal(episodes[0].peers, 0);
    assert.equal(episodes[0].sizeBytes, 0);
    assert.deepEqual(requests.map(request => request.url.pathname),
        Object.keys(payloads).map(endpoint => `/api/catalog/${endpoint}`));
    assert.ok(requests.every(request => request.url.origin === 'https://yify.expo.app' &&
        request.options.redirect === 'error' && request.options.credentials === 'omit'));
    assert.deepEqual(Object.fromEntries(requests[4].url.searchParams), {page: '2', limit: '50', imdbId: '1234567'});
    assert.deepEqual(Object.fromEntries(requests[5].url.searchParams), {imdbId: '1234567'});
});

test('unexpected metadata fields are projected away and malformed values fail closed', async t => {
    let payload = {...details(), futureProperty: {arbitrary: true}};
    t.mock.method(globalThis, 'fetch', async () => ({ok: true, status: 200, json: async () => payload}));
    assert.equal(Object.hasOwn(await client().getMovieDetails(42), 'futureProperty'), false);
    for (const patch of [{id: '42'}, {rating: NaN}, {title: null}, {posterUrls: ['javascript:alert(1)']},
        {screenshotUrls: [false]}, {cast: [{name: 'Actor'}]}, {genres: 'Drama'}]) {
        payload = {...details(), ...patch};
        await assert.rejects(client().getMovieDetails(42), /catalog is unavailable/i);
    }
    payload = [{...episode(), releasedAt: 'invalid date'}];
    await assert.rejects(client().listEpisodes('1234567'), /catalog is unavailable/i);
});

test('the real server projection and web client agree across all catalog response shapes', async t => {
    const {createCatalogHandler} = loadTypeScript('data/server/catalog/handler.ts');
    const nativeMovie = {...details(), downloadCount: 25,
        torrents: [{url: 'https://provider.example/file.torrent', hash: 'a'.repeat(40)}]};
    const nativeEpisode = {...episode(), releasedAt: new Date(date), seeds: 20, peers: 10,
        sizeBytes: 1000, magnetUrl: 'magnet:?xt=urn:btih:example'};
    const nativeShow = {...show(), latestEpisode: nativeEpisode, updatedAt: new Date(date)};
    const handle = createCatalogHandler({
        movies: {
            listMovies: async () => ({movies: [nativeMovie], pageNumber: 1, movieCount: 1, hasMore: false}),
            getMovieDetails: async () => nativeMovie,
            getMovieSuggestions: async () => [nativeMovie],
            getMovieParentalGuides: async () => [{type: 'violence', text: 'Mild action.'}],
        },
        shows: {
            listShows: async () => ({shows: [nativeShow], pageNumber: 1, hasMore: false}),
            listEpisodes: async () => [nativeEpisode],
        },
    });
    const responses = [];
    t.mock.method(globalThis, 'fetch', async url => {
        const response = await handle(new Request(url), new URL(url).pathname.split('/').at(-1));
        responses.push(await response.clone().text());
        return response;
    });
    const api = client();
    assert.equal((await api.listMovies({page: 1})).movies[0].id, 42);
    assert.deepEqual((await api.getMovieDetails(42)).torrents, []);
    assert.equal((await api.getMovieSuggestions(42))[0].id, 42);
    assert.equal((await api.getMovieParentalGuides(42))[0].type, 'violence');
    assert.equal((await api.listShows({page: 1})).shows[0].updatedAt.toISOString(), date);
    assert.equal((await api.listEpisodes('1234567'))[0].magnetUrl, '');
    assert.equal(responses.length, 6);
    assert.ok(responses.every(body => !/torrent|magnet|downloadCount|sizeBytes|seeds|peers|provider\.example/i.test(body)));
});

test('raw providers and nested download data are rejected without fallback or cached reuse', async t => {
    let payload;
    const requests = [];
    t.mock.method(globalThis, 'fetch', async url => {
        requests.push(url);
        return {ok: true, status: 200, json: async () => payload};
    });
    const api = client();
    const failures = [
        {status: 'ok', data: {movie: details()}},
        {...details(), torrents: []},
        {...details(), downloadCount: 10},
        {...details(), extra: {hash: 'a'.repeat(40)}},
        {...details(), extra: {magnet_url: 'magnet:?xt=urn:btih:example'}},
        {...details(), synopsis: 'See magnet:?xt=urn:btih:example'},
    ];
    for (payload of failures) await assert.rejects(api.getMovieDetails(42), /catalog is unavailable/i);
    payload = details();
    assert.equal((await api.getMovieDetails(42)).id, 42);
    assert.equal(requests.length, failures.length + 1);
    assert.ok(requests.every(url => url === `${base}/movie?id=42`));
});

test('HTTP, JSON and network failures remain generic and never call another provider', async t => {
    const requests = [];
    for (const response of [
        async () => ({ok: false, status: 503, json: async () => assert.fail('error body must not be consumed')}),
        async () => ({ok: true, status: 200, json: async () => { throw new Error('private upstream response'); }}),
        async () => { throw new Error('private upstream address'); },
    ]) {
        t.mock.method(globalThis, 'fetch', async url => { requests.push(url); return response(); });
        await assert.rejects(client().listMovies({page: 1}), error =>
            error.message === 'The catalog is unavailable. Please try again.');
    }
    assert.deepEqual(requests, Array(3).fill(`${base}/movies?page=1`));
});

test('identical requests share fetching and validation until the metadata cache expires', async t => {
    let now = 1_000;
    let requests = 0;
    let parses = 0;
    let finish;
    const pending = new Promise(resolve => { finish = resolve; });
    t.mock.method(Date, 'now', () => now);
    t.mock.method(globalThis, 'fetch', async () => {
        requests++;
        await pending;
        return {ok: true, status: 200, json: async () => {
            parses++;
            return {movies: [movie()], pageNumber: 1, movieCount: 1, hasMore: false};
        }};
    });
    const api = client();
    const first = api.listMovies({page: 1});
    const second = api.listMovies({page: 1});
    finish();
    assert.equal(await first, await second);
    await api.listMovies({page: 1});
    assert.equal(requests, 1);
    assert.equal(parses, 1);
    now += 60_000;
    await api.listMovies({page: 1});
    assert.equal(requests, 2);
    await api.listMovies({page: 2});
    assert.equal(requests, 3);
});

test('timeout aborts the metadata request and a later request can recover', async t => {
    t.mock.timers.enable({apis: ['setTimeout']});
    let requests = 0;
    let signal;
    t.mock.method(globalThis, 'fetch', async (_url, options) => {
        requests++;
        signal = options.signal;
        if (requests > 1) return {ok: true, status: 200, json: async () => details()};
        return new Promise((_resolve, reject) => signal.addEventListener('abort', () => reject(new Error('aborted'))));
    });
    const api = client();
    const failed = assert.rejects(api.getMovieDetails(42), /catalog request timed out/i);
    await Promise.resolve();
    t.mock.timers.tick(30_000);
    await failed;
    assert.equal(signal.aborted, true);
    assert.equal((await api.getMovieDetails(42)).id, 42);
    assert.equal(requests, 2);
});

test('web notification checks use the metadata repository independently of the main factory', async t => {
    setGlobal(t, 'window', {location: new URL('https://kunal26das.github.io/yify/'), Notification: {}});
    setGlobal(t, 'Notification', {permission: 'granted'});
    const requests = [];
    t.mock.method(globalThis, 'fetch', async url => {
        requests.push(url);
        return {ok: true, status: 200, json: async () =>
            ({movies: [movie()], pageNumber: 1, movieCount: 1, hasMore: false})};
    });
    const {checkForNewMovies} = loadTypeScript('data/services/NewMoviesNotifierImpl.web.ts', {
        'expo-router': {router: {push() {}}},
        '../datasources/storage/PersistentCache': {PersistentCache: class {
            values = new Map();
            getString(key) { return this.values.get(key); }
            set(key, value) { this.values.set(key, value); }
        }},
        '../repositories/PreferencesRepositoryImpl': {PreferencesRepositoryImpl: class {
            getPreferences() { return {notifications: true, notify: {quality: '1080p', quietHours: false}}; }
        }},
    });
    assert.equal(await checkForNewMovies(true), 0);
    assert.deepEqual(requests, [`${base}/movies?page=1&limit=50&quality=1080p`]);
});

test('native catalog factory retains its configured source and native torrent metadata', async t => {
    const requests = [];
    t.mock.method(globalThis, 'fetch', async url => {
        requests.push(url);
        return {ok: true, status: 200, json: async () => ({status: 'ok', data: {movie: {
            id: 42, title: 'Native', genres: [], torrents: [{url: 'https://provider.example/file.torrent',
                hash: 'a'.repeat(40), quality: '1080p', date_uploaded_unix: 1}],
        }}})};
    });
    const {createCatalogRepositories} = loadTypeScript('data/di/catalogRepositories.ts');
    const repositories = createCatalogRepositories({getApiBaseUrl: () => 'https://configured.example/api/v2'});
    const detail = await repositories.movies.getMovieDetails(42);
    assert.equal(detail.torrents[0].hash, 'a'.repeat(40));
    assert.equal(detail.torrents[0].url, 'https://provider.example/file.torrent');
    assert.ok(requests[0].startsWith('https://configured.example/api/v2/'));
});
