const assert = require('node:assert/strict');
const {test} = require('node:test');
const {loadTypeScript} = require('./helpers/load-typescript.cjs');

function deferred() {
    let resolve;
    let reject;
    const promise = new Promise((done, fail) => { resolve = done; reject = fail; });
    return {promise, resolve, reject};
}

test('show details share their identical first episode-page request and JSON decoding', async (t) => {
    const {EztvApiDataSource} = loadTypeScript('data/datasources/EztvApiDataSource.ts');
    const {ShowRepositoryImpl} = loadTypeScript('data/repositories/ShowRepositoryImpl.ts');
    const response = deferred();
    let requests = 0;
    let parses = 0;
    t.mock.method(global, 'fetch', async () => {
        requests += 1;
        await response.promise;
        return {ok: true, json: async () => { parses += 1; return {page: 1, torrents: []}; }};
    });
    const repository = new ShowRepositoryImpl(new EztvApiDataSource());
    const title = repository.listShows({page: 1, imdbId: '123'});
    const episodes = repository.listEpisodes('123');
    response.resolve();
    await Promise.all([title, episodes]);
    assert.equal(requests, 1);
    assert.equal(parses, 1);
});

test('EZTV reuses recent pages but refreshes after one minute and isolates endpoints', async (t) => {
    const {EztvApiDataSource} = loadTypeScript('data/datasources/EztvApiDataSource.ts');
    let now = 1000;
    let baseUrl = 'https://first.example/api';
    const requests = [];
    t.mock.method(Date, 'now', () => now);
    t.mock.method(global, 'fetch', async (url) => {
        requests.push(url);
        return {ok: true, json: async () => ({page: 1, torrents: []})};
    });
    const api = new EztvApiDataSource(() => baseUrl);
    await api.getTorrents({page: 1, imdb_id: '123'});
    await api.getTorrents({page: 1, limit: 50, imdb_id: '123'});
    assert.equal(requests.length, 1);
    now += 60_000;
    await api.getTorrents({page: 1, imdb_id: '123'});
    assert.equal(requests.length, 2);
    baseUrl = 'https://second.example/api';
    await api.getTorrents({page: 1, imdb_id: '123'});
    assert.equal(requests.length, 3);
    assert.ok(requests[2].startsWith(baseUrl));
});

test('transient EZTV errors are shared while pending and a later request can retry', async (t) => {
    const {EztvApiDataSource} = loadTypeScript('data/datasources/EztvApiDataSource.ts');
    let requests = 0;
    t.mock.method(global, 'fetch', async () => {
        requests += 1;
        return requests === 1
            ? {ok: false, status: 503}
            : {ok: true, json: async () => ({torrents: []})};
    });
    const api = new EztvApiDataSource();
    const results = await Promise.allSettled([api.getTorrents({page: 1}), api.getTorrents({page: 1})]);
    assert.equal(requests, 1);
    assert.ok(results.every((result) => result.status === 'rejected' && result.reason.name === 'EztvUnavailableError'));
    await api.getTorrents({page: 1});
    assert.equal(requests, 2);
});

test('TMDB title and provider lookups deduplicate in flight and reuse decoded responses', async (t) => {
    const {TmdbApiDataSource} = loadTypeScript('data/datasources/TmdbApiDataSource.ts');
    const response = deferred();
    let requests = 0;
    let parses = 0;
    t.mock.method(global, 'fetch', async () => {
        requests += 1;
        await response.promise;
        return {ok: true, json: async () => { parses += 1; return {id: 123}; }};
    });
    const api = new TmdbApiDataSource(async () => 'test-key');
    const pending = [api.findByImdbId('tt123'), api.findByImdbId('tt123')];
    response.resolve();
    await Promise.all(pending);
    await api.findByImdbId('tt123');
    await Promise.all([api.getWatchProviders(123, 'movie'), api.getWatchProviders(123, 'movie')]);
    await api.getWatchProviders(123, 'movie');
    assert.equal(requests, 2);
    assert.equal(parses, 2);
    await api.getWatchProviders(123, 'tv');
    assert.equal(requests, 3, 'movie and TV provider responses remain separate');
});

test('TMDB refreshes expired data and retries errors without reusing another API key', async (t) => {
    const {TmdbApiDataSource} = loadTypeScript('data/datasources/TmdbApiDataSource.ts');
    let now = 1000;
    let key = 'test-key-a';
    let requests = 0;
    t.mock.method(Date, 'now', () => now);
    t.mock.method(global, 'fetch', async () => {
        requests += 1;
        if (requests === 1) throw new Error('offline');
        return {ok: true, json: async () => ({movie_results: []})};
    });
    const api = new TmdbApiDataSource(() => key);
    await assert.rejects(api.findByImdbId('tt123'), /offline/);
    await api.findByImdbId('tt123');
    await api.findByImdbId('tt123');
    assert.equal(requests, 2);
    now += 10 * 60_000;
    await api.findByImdbId('tt123');
    assert.equal(requests, 3);
    key = 'test-key-b';
    await api.findByImdbId('tt123');
    assert.equal(requests, 4);
});

test('response cache evicts least recently used results and expires from response completion', async (t) => {
    const {ResponseCache} = loadTypeScript('data/datasources/storage/ResponseCache.ts');
    const cache = new ResponseCache(2);
    const response = deferred();
    let now = 0;
    let requests = 0;
    t.mock.method(Date, 'now', () => now);
    const load = async () => { requests += 1; return requests; };
    const initial = cache.getOrLoad('a', 100, () => response.promise);
    now = 200;
    assert.equal(cache.getOrLoad('a', 100, load), initial, 'a slow pending request stays shared');
    response.resolve(1);
    await initial;
    now = 250;
    assert.equal(await cache.getOrLoad('a', 100, load), 1, 'TTL starts when the response arrives');
    await cache.getOrLoad('b', 100, load);
    await cache.getOrLoad('a', 100, load);
    await cache.getOrLoad('c', 100, load);
    await cache.getOrLoad('b', 100, load);
    assert.equal(requests, 3, 'the least recently used b entry was evicted');
});

test('an older evicted failure cannot evict its replacement request', async () => {
    const {ResponseCache} = loadTypeScript('data/datasources/storage/ResponseCache.ts');
    const cache = new ResponseCache(1);
    const older = deferred();
    const first = cache.getOrLoad('a', 1000, () => older.promise);
    const rejected = assert.rejects(first, /older request failed/);
    await cache.getOrLoad('b', 1000, async () => 'b');
    const replacement = cache.getOrLoad('a', 1000, async () => 'new a');
    older.reject(new Error('older request failed'));
    await rejected;
    await replacement;
    assert.equal(await cache.getOrLoad('a', 1000, async () => assert.fail('replacement was evicted')), 'new a');
});

function watchlistFixture(raw) {
    const {WatchlistRepositoryImpl} = loadTypeScript('data/repositories/WatchlistRepositoryImpl.ts');
    const values = new Map(raw === undefined ? [] : [['items', raw]]);
    const writes = [];
    const store = {
        getString: (key) => values.get(key),
        set: (key, value) => { writes.push(value); values.set(key, value); },
    };
    return {repository: new WatchlistRepositoryImpl(store), writes, reload: () => new WatchlistRepositoryImpl(store)};
}

test('watchlist membership avoids scanning saved movies during repeated card snapshot checks', () => {
    const saved = Array.from({length: 5000}, (_, id) => ({id}));
    const {repository} = watchlistFixture(JSON.stringify(saved));
    const movies = repository.getAll();
    let reads = 0;
    for (const movie of movies) {
        const id = movie.id;
        Object.defineProperty(movie, 'id', {get: () => { reads += 1; return id; }});
    }
    for (let check = 0; check < 200; check += 1) {
        assert.equal(repository.contains(4999), true);
        assert.equal(repository.contains(5001), false);
    }
    assert.equal(reads, 0, '400 card checks should not revisit any saved movie');
});

test('watchlist membership stays correct across local edits, sync replacement, persistence and clear', () => {
    const {repository, writes, reload} = watchlistFixture(JSON.stringify([{id: 1}]));
    const snapshots = [];
    repository.subscribe(() => snapshots.push([repository.contains(1), repository.contains(2)]));
    assert.equal(repository.contains(1), true);
    repository.add({id: 1});
    assert.equal(writes.length, 0);
    assert.equal(repository.toggle({id: 2}), true);
    assert.equal(repository.toggle({id: 1}), false);
    assert.deepEqual(snapshots, [[true, true], [false, true]]);
    assert.equal(reload().contains(2), true);
    repository.applyRemote([{id: 1}]);
    assert.equal(repository.contains(1), true);
    assert.equal(repository.contains(2), false);
    repository.clear();
    assert.equal(repository.contains(1), false);
    assert.deepEqual(repository.getAll(), []);
    assert.equal(reload().contains(1), false);
});
