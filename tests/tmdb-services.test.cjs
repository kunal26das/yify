const assert = require('node:assert/strict');
const {test} = require('node:test');
const {loadTypeScript} = require('./helpers/load-typescript.cjs');

const {TmdbRepositoryImpl} = loadTypeScript('data/repositories/TmdbRepositoryImpl.ts');
const {TmdbApiDataSource} = loadTypeScript('data/datasources/TmdbApiDataSource.ts');
const service = (id, name, logo = '/logo.png') => ({provider_id: id, provider_name: name, logo_path: logo});
const response = (body, status = 200, headers = {}) => ({ok: status >= 200 && status < 300, status,
    headers: new Headers(headers), json: async () => body});

test('regional service catalogs combine movie and TV providers without conflating channel IDs', async () => {
    const calls = [];
    const repository = new TmdbRepositoryImpl({getWatchServices: async (region, media) => {
        calls.push({region, media});
        return {results: media === 'movie' ? [service(9, 'Prime Video'), service(8, 'Netflix'), service(8, 'Netflix')]
            : [service(9, 'Prime Video'), service(100, 'Max Amazon Channel'), service(777, 'Regional service', null)]};
    }});
    const services = await repository.getWatchServices('GB');
    assert.deepEqual(calls, [{region: 'GB', media: 'movie'}, {region: 'GB', media: 'tv'}]);
    assert.deepEqual(services.map(({id, name}) => ({id, name})), [
        {id: 100, name: 'Max Amazon Channel'}, {id: 8, name: 'Netflix'},
        {id: 9, name: 'Prime Video'}, {id: 777, name: 'Regional service'},
    ]);
    assert.equal(services[0].logoUrl, 'https://image.tmdb.org/t/p/w92/logo.png');
    assert.equal(services[3].logoUrl, undefined);
    assert.ok(services.every(entry => !Object.hasOwn(entry, 'offer') && !Object.hasOwn(entry, 'parentName')));
});

test('service catalogs reject missing structures while tolerating invalid entries beside valid providers', async () => {
    const valid = service(8, ' Netflix ');
    const invalid = [null, 'bad', service(0, 'Zero'), service(-1, 'Negative'), service(1.5, 'Decimal'),
        service(Number.MAX_SAFE_INTEGER + 1, 'Unsafe'), service('9', 'String'), service(10, ''), service(11, '   ')];
    const mixed = new TmdbRepositoryImpl({getWatchServices: async () => ({results: [...invalid, valid]})});
    assert.deepEqual((await mixed.getWatchServices('US')).map(({id, name}) => ({id, name})), [{id: 8, name: 'Netflix'}]);
    for (const value of [null, {}, [], {results: null}, {results: {}}, {results: invalid}, {success: false, results: []}]) {
        await assert.rejects(new TmdbRepositoryImpl({getWatchServices: async () => value}).getWatchServices('US'), /Invalid TMDB/);
    }
    assert.deepEqual(await new TmdbRepositoryImpl({getWatchServices: async () => ({results: []})}).getWatchServices('US'), []);
});

test('one failed media catalog fails the combined result instead of pretending to be complete', async () => {
    for (const failedMedia of ['movie', 'tv']) {
        const repository = new TmdbRepositoryImpl({getWatchServices: async (_region, media) => {
            if (media === failedMedia) throw new Error('offline');
            return {results: [service(8, 'Netflix')]};
        }});
        await assert.rejects(repository.getWatchServices('US'), /offline/);
    }
    const partialEmpty = new TmdbRepositoryImpl({getWatchServices: async (_region, media) => ({results: media === 'movie' ? [] : [service(8, 'Netflix')]})});
    assert.deepEqual((await partialEmpty.getWatchServices('US')).map(entry => entry.id), [8]);
});

test('malformed title and country responses never become successful empty availability', async () => {
    for (const value of [null, [], {}, {success: false}, {success: false, results: {}}, {results: null}, {results: []}, {results: {US: null}},
        {results: {US: {flatrate: {}}}}, {results: {US: {flatrate: [null]}}}]) {
        await assert.rejects(new TmdbRepositoryImpl({getWatchProviders: async () => value}).getWatchAvailability(42, 'movie', 'US'), /Invalid TMDB/);
    }
    for (const value of [null, [], {}, {success: false}, {success: false, results: []}, {results: null}, {results: {}}, {results: [null]}]) {
        await assert.rejects(new TmdbRepositoryImpl({getWatchRegions: async () => value}).getWatchRegions(), /Invalid TMDB/);
    }
    assert.deepEqual(await new TmdbRepositoryImpl({getWatchProviders: async () => ({results: {}})}).getWatchAvailability(42, 'movie', 'US'),
        {region: 'US', providers: []});
    assert.deepEqual(await new TmdbRepositoryImpl({getWatchRegions: async () => ({results: []})}).getWatchRegions(), []);
});

test('malformed IMDb results fail while well-formed empty lists and TV matches remain supported', async () => {
    for (const value of [null, [], {}, {success: false}, {success: false, movie_results: []}, {movie_results: null}, {tv_results: {}},
        {movie_results: [], tv_results: 'bad'}, {movie_results: [null]}, {tv_results: [{id: 0}]},
        {movie_results: [{id: 42, title: {text: 'bad'}}]}]) {
        await assert.rejects(new TmdbRepositoryImpl({findByImdbId: async () => value}).findByImdbCode('tt1234567'), /Invalid TMDB/);
    }
    assert.equal(await new TmdbRepositoryImpl({findByImdbId: async () => ({movie_results: [], tv_results: []})}).findByImdbCode('tt1234567'), null);
    const found = await new TmdbRepositoryImpl({findByImdbId: async () => ({movie_results: [], tv_results: [{id: 42, name: 'A show'}]})}).findByImdbCode('tt1234567');
    assert.equal(found.media, 'tv');
    assert.equal(found.tmdbId, 42);
});

test('datasource requests only the requested country and coalesces concurrent movie and TV catalog loads', async t => {
    const calls = [];
    let finish;
    const waiting = new Promise(resolve => {finish = resolve;});
    t.mock.method(globalThis, 'fetch', async url => {calls.push(new URL(url)); await waiting; return response({results: [service(8, 'Netflix')]});});
    const source = new TmdbApiDataSource(() => 'test-key');
    const repository = new TmdbRepositoryImpl(source);
    const first = repository.getWatchServices('US');
    const second = repository.getWatchServices('US');
    await new Promise(setImmediate);
    assert.equal(calls.length, 2);
    assert.deepEqual(calls.map(url => url.pathname).sort(), ['/3/watch/providers/movie', '/3/watch/providers/tv']);
    assert.ok(calls.every(url => url.searchParams.get('watch_region') === 'US' && url.searchParams.get('language') === 'en-US'));
    finish();
    assert.deepEqual(await first, await second);
    await repository.getWatchServices('US');
    assert.equal(calls.length, 2);
    await repository.getWatchServices('GB');
    assert.equal(calls.length, 4);
    assert.ok(calls.slice(2).every(url => url.searchParams.get('watch_region') === 'GB'));
});

test('invalid country and media inputs fail before resolving credentials or calling the network', async t => {
    let requests = 0;
    let credentials = 0;
    t.mock.method(globalThis, 'fetch', async () => {requests++; return response({results: []});});
    const source = new TmdbApiDataSource(() => {credentials++; return 'test-key';});
    for (const region of ['us', 'USA', '../US', '']) {
        await assert.rejects(source.getWatchServices(region, 'movie'), /Invalid watch service/);
        await assert.rejects(new TmdbRepositoryImpl(source).getWatchServices(region), /Invalid watch service/);
    }
    await assert.rejects(source.getWatchServices('US', '../movie'), /Invalid watch service/);
    assert.equal(requests, 0);
    assert.equal(credentials, 0);
});

test('429 and Retry-After responses do not cause immediate retries or cache empty services', async t => {
    let calls = 0;
    let allowed = false;
    t.mock.method(globalThis, 'fetch', async () => {calls++; return allowed
        ? response({results: [service(8, 'Netflix')]}) : response({status_message: 'Rate limited'}, 429, {'Retry-After': '60'});});
    const source = new TmdbApiDataSource(() => 'test-key');
    await assert.rejects(source.getWatchServices('US', 'movie'), error => error.status === 429);
    assert.equal(calls, 1);
    allowed = true;
    assert.equal((await source.getWatchServices('US', 'movie')).results[0].provider_id, 8);
    assert.equal(calls, 2);
});

test('malformed successful responses are removed from request cache so explicit retry can recover', async t => {
    let body = {success: false};
    let calls = 0;
    t.mock.method(globalThis, 'fetch', async () => {calls++; return response(body);});
    const source = new TmdbApiDataSource(() => 'test-key');
    for (const [load, valid] of [
        [() => source.getWatchServices('US', 'movie'), {results: [service(8, 'Netflix')]}],
        [() => source.getWatchRegions(), {results: [{iso_3166_1: 'US', english_name: 'United States'}]}],
        [() => source.getWatchProviders(42, 'movie'), {results: {US: {flatrate: [service(8, 'Netflix')]}}}],
        [() => source.findByImdbId('tt1234567'), {movie_results: []}],
    ]) {
        body = {success: false};
        const before = calls;
        await assert.rejects(load(), /Invalid TMDB/);
        body = valid;
        await load();
        await load();
        assert.equal(calls - before, 2);
    }
});
