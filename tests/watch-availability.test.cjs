const assert = require('node:assert/strict');
const {test} = require('node:test');
const {loadTypeScript} = require('./helpers/load-typescript.cjs');

const {TmdbRepositoryImpl} = loadTypeScript('data/repositories/TmdbRepositoryImpl.ts');
const {PreferencesRepositoryImpl, parseSyncedPreferences} = loadTypeScript('data/repositories/PreferencesRepositoryImpl.ts');

const provider = {provider_id: 90001, provider_name: 'Regional service', logo_path: '/logo.png'};
const watchPage = 'https://www.themoviedb.org/movie/42-example/watch?locale=US';
const api = entry => ({getWatchProviders: async () => ({results: {IN: entry}})});

test('regional availability retains unfamiliar services and every distinct offer type', async () => {
    const repository = new TmdbRepositoryImpl(api({
        link: watchPage, flatrate: [provider, provider], rent: [provider], buy: [provider], free: [provider], ads: [provider],
    }));
    const result = await repository.getWatchAvailability(42, 'movie', 'IN');
    assert.deepEqual(result.providers.map(item => item.offer), ['stream', 'free', 'ads', 'rent', 'buy']);
    assert.equal(result.url, 'https://www.themoviedb.org/movie/42-example/watch?locale=IN');
    assert.equal(result.providers[0].name, 'Regional service');
});

test('watch-page links reject foreign domains, wrong titles, and unsafe URLs', async () => {
    for (const link of ['https://evil.example/movie/42/watch', 'https://www.themoviedb.org.evil.example/movie/42/watch',
        'http://www.themoviedb.org/movie/42/watch', 'https://user@www.themoviedb.org/movie/42/watch',
        'https://www.themoviedb.org/movie/420/watch', 'https://www.themoviedb.org/tv/42/watch',
        'https://www.themoviedb.org/movie/42', 'javascript:alert(1)']) {
        const result = await new TmdbRepositoryImpl(api({link, flatrate: [provider]})).getWatchAvailability(42, 'movie', 'IN');
        assert.equal(result.url, undefined, link);
        assert.equal(result.providers.length, 1);
    }
    const result = await new TmdbRepositoryImpl(api({link: 'https://www.themoviedb.org/tv/42/watch?locale=US&redirect=evil#fragment',
        flatrate: [provider]})).getWatchAvailability(42, 'tv', 'IN');
    assert.equal(result.url, 'https://www.themoviedb.org/tv/42/watch?locale=IN');
});

test('a country with no offers remains distinct from a failed availability request', async () => {
    const repository = new TmdbRepositoryImpl(api({flatrate: [provider]}));
    assert.deepEqual(await repository.getWatchAvailability(42, 'movie', 'GB'), {region: 'GB', providers: []});
    const failing = new TmdbRepositoryImpl({getWatchProviders: async () => {throw new Error('offline');}});
    await assert.rejects(failing.getWatchAvailability(42, 'movie', 'IN'), /offline/);
    assert.equal(await repository.getWatchAvailability(42, 'movie', 'invalid'), null);
});

test('failed title lookups can be retried instead of looking like an unsupported title', async () => {
    const repository = new TmdbRepositoryImpl({findByImdbId: async () => {throw new Error('offline');}});
    await assert.rejects(repository.findByImdbCode('tt1234567'), /offline/);
    assert.equal(await new TmdbRepositoryImpl({findByImdbId: async () => ({})}).findByImdbCode('tt1234567'), null);
});

test('supported countries come from the provider API and are validated, deduplicated, and sorted', async () => {
    const repository = new TmdbRepositoryImpl({getWatchRegions: async () => ({results: [
        {iso_3166_1: 'US', english_name: 'United States'}, {iso_3166_1: 'IN', english_name: 'India'},
        {iso_3166_1: 'IN', english_name: 'India'}, {iso_3166_1: 'bad', english_name: 'Invalid'},
    ]})});
    assert.deepEqual(await repository.getWatchRegions(), [{code: 'IN', name: 'India'}, {code: 'US', name: 'United States'}]);
});

test('country preference persists, syncs, and preserves manual choice when older clients omit it', () => {
    const values = new Map();
    const store = {getString: key => values.get(key), set: (key, value) => values.set(key, value)};
    const preferences = new PreferencesRepositoryImpl(store);
    assert.equal(preferences.getPreferences().watchRegion, null);
    preferences.setWatchRegion('IN');
    assert.equal(new PreferencesRepositoryImpl(store).getPreferences().watchRegion, 'IN');
    assert.equal(preferences.getSynced().watchRegion, 'IN');
    const older = parseSyncedPreferences(JSON.stringify({theme: 'dark'}));
    preferences.applyRemote(older);
    assert.equal(preferences.getPreferences().watchRegion, 'IN');
    preferences.applyRemote({...older, watchRegion: null});
    assert.equal(preferences.getPreferences().watchRegion, null);
    preferences.setWatchRegion('not a country');
    assert.equal(preferences.getPreferences().watchRegion, null);
    assert.equal(parseSyncedPreferences('{"watchRegion":"http://bad"}').watchRegion, undefined);
});
