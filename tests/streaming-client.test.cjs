const assert = require('node:assert/strict');
const {test} = require('node:test');
const {loadTypeScript} = require('./helpers/load-typescript.cjs');

const {StreamingRepositoryImpl, parseStreamingAvailability} = loadTypeScript('data/repositories/StreamingRepositoryImpl.ts');
const {hasSelectedStreamingOffer, streamingOfferSelected, streamingOfferLabel, safeStreamingUrl} = loadTypeScript('domain/policies/streaming.ts');
const watchUrl = country => 'https://www.themoviedb.org/movie/238/watch?locale=' + country;
const offer = {serviceId: 'tmdb:9', serviceName: 'Prime Video', selectionId: 'tmdb:9', type: 'subscription', url: watchUrl('US')};
const availability = (country = 'US', offers = [offer]) => ({country, status: 'ready', offers, checkedAt: Date.now()});
function storage() {
    const saved = new Map();
    return {getString: key => saved.get(key), set: (key, value) => saved.set(key, value), delete: key => saved.delete(key)};
}
function fixture(overrides = {}, store = storage()) {
    const calls = {regions: 0, services: [], find: [], offers: []};
    const tmdb = {
        getWatchRegions: async () => {calls.regions++; return [{code: 'US', name: 'United States'}, {code: 'IN', name: 'India'}];},
        getWatchServices: async country => {calls.services.push(country); return [{id: 9, name: 'Prime Video'}, {id: 2100, name: 'Prime Video Channel'}];},
        findByImdbCode: async id => {calls.find.push(id); return {tmdbId: 238, media: 'movie', title: 'The Godfather'};},
        getWatchAvailability: async (id, media, country) => {
            calls.offers.push([id, media, country]);
            return {region: country, providers: [{id: 9, name: 'Prime Video', offer: 'stream'}], url: watchUrl(country)};
        },
        ...overrides,
    };
    return {repo: new StreamingRepositoryImpl(tmdb, store), calls, tmdb, store};
}

test('country and exact provider identities keep paid channels and purchases separate', () => {
    assert.equal(hasSelectedStreamingOffer(availability(), 'US', ['tmdb:9']), true);
    assert.equal(hasSelectedStreamingOffer(availability(), 'IN', ['tmdb:9']), false);
    assert.equal(hasSelectedStreamingOffer({...availability(), status: 'unavailable'}, 'US', ['tmdb:9']), false);
    for (const type of ['rent', 'buy']) assert.equal(streamingOfferSelected({...offer, type}, ['tmdb:9']), false);
    assert.equal(streamingOfferSelected({...offer, type: 'ads'}, ['tmdb:9']), true);
    assert.equal(streamingOfferLabel({...offer, type: 'ads'}), 'Free with ads');
    assert.equal(streamingOfferSelected({...offer, serviceId: 'tmdb:2100', selectionId: 'tmdb:2100'}, ['tmdb:9']), false);
});

test('links reject credential-bearing, local, executable, and non-HTTPS destinations', () => {
    for (const url of ['javascript:alert(1)', 'http://www.netflix.com/title/1', 'https://user:secret@netflix.com/',
        'https://localhost/title/1', 'https://127.0.0.1/', 'https://[::1]/', 'https://example.internal/', 'https://netflix.com:1234/']) {
        assert.equal(safeStreamingUrl(url), undefined, url);
    }
    assert.equal(safeStreamingUrl(watchUrl('US')), watchUrl('US'));
});

test('catalog loads lazily for just the requested country and restores its cache', async () => {
    const f = fixture();
    assert.equal(f.calls.regions, 0);
    assert.equal(f.calls.services.length, 0);
    const [first, shared] = await Promise.all([f.repo.getCatalog('US'), f.repo.getCatalog('US')]);
    assert.deepEqual(first, shared);
    assert.equal(f.calls.regions, 1);
    assert.deepEqual(f.calls.services, ['US']);
    assert.deepEqual(first.countries[0].services.map(service => service.id), ['tmdb:9', 'tmdb:2100']);
    assert.deepEqual(first.countries.map(country => country.code), ['US']);
    const restored = new StreamingRepositoryImpl(f.tmdb, f.store);
    assert.deepEqual(await restored.getCatalog('US'), first);
    assert.equal(f.calls.regions, 1);
    assert.deepEqual(f.calls.services, ['US']);
    await restored.getCatalog('IN');
    assert.deepEqual(f.calls.services, ['US', 'IN']);
    assert.equal(f.calls.regions, 1);
});

test('title requests coalesce, persist, reuse IMDb lookups and stay separated by country', async () => {
    const f = fixture();
    const results = await Promise.all([f.repo.getAvailability('tt0068646', 'US'), f.repo.getAvailability('tt0068646', 'US')]);
    assert.equal(f.calls.offers.length, 1);
    assert.deepEqual(results[0], results[1]);
    await f.repo.getAvailability('tt0068646', 'IN');
    assert.equal(f.calls.offers.length, 2);
    assert.equal(f.calls.find.length, 1);
    assert.equal(f.calls.regions, 1);
    const restored = new StreamingRepositoryImpl(f.tmdb, f.store);
    assert.equal(restored.getCachedAvailability('tt0068646', 'US').country, 'US');
    await restored.getAvailability('tt0068646', 'US');
    assert.equal(f.calls.offers.length, 2);
});

test('unsupported country skips services and title calls; valid empty data remains ready', async () => {
    const f = fixture({getWatchAvailability: async (_id, _media, country) => ({region: country, providers: []})});
    assert.deepEqual((await f.repo.getCatalog('FR')).countries, []);
    assert.equal((await f.repo.getAvailability('tt0068646', 'FR')).status, 'unsupported-country');
    assert.equal(f.calls.find.length, 0);
    assert.equal(f.calls.services.length, 0);
    const known = await f.repo.getAvailability('tt0068646', 'US');
    assert.equal(known.status, 'ready');
    assert.deepEqual(known.offers, []);
    const missing = fixture({findByImdbCode: async () => null});
    assert.equal((await missing.repo.getAvailability('tt1234567', 'US')).status, 'ready');
    assert.equal(missing.calls.offers.length, 0);
});

test('network and malformed data stay unavailable, uncached and retryable', async () => {
    let failed = true;
    const f = fixture({getWatchAvailability: async (_id, _media, country) => {
        if (failed) throw new Error('429');
        return {region: country, providers: []};
    }});
    assert.equal((await f.repo.getAvailability('tt0068646', 'US')).status, 'unavailable');
    assert.equal(f.repo.getCachedAvailability('tt0068646', 'US'), null);
    failed = false;
    assert.equal((await f.repo.getAvailability('tt0068646', 'US')).status, 'ready');
    for (const value of [null, {region: 'IN', providers: []}, {region: 'US', providers: null},
        {region: 'US', providers: [{id: -1, name: 'Invalid', offer: 'stream'}]}]) {
        const broken = fixture({getWatchAvailability: async () => value});
        assert.equal((await broken.repo.getAvailability('tt0068646', 'US')).status, 'unavailable');
        assert.equal(broken.repo.getCachedAvailability('tt0068646', 'US'), null);
    }
    const brokenCatalog = fixture({getWatchServices: async () => [{id: 9, name: 'Prime'}, {id: 9, name: 'Duplicate'}]});
    assert.equal((await brokenCatalog.repo.getCatalog('US')).status, 'unavailable');
    const offline = fixture({getWatchRegions: async () => {throw new Error('offline');}});
    assert.equal((await offline.repo.getCatalog('US')).status, 'unavailable');
    assert.equal((await offline.repo.getAvailability('tt0068646', 'US')).status, 'unavailable');
});

test('invalid identifiers make no requests and wrong media never reuses another cached result', async () => {
    const f = fixture();
    await f.repo.getCatalog('us');
    await f.repo.getAvailability('../countries', 'US');
    await f.repo.getAvailability('tt0068646', 'us');
    assert.equal(f.calls.regions, 0);
    const movie = await f.repo.getAvailability('tt0068646', 'US');
    assert.equal(movie.offers.length, 1);
    assert.equal((await f.repo.getAvailability('tt0068646', 'US', 'tv')).offers.length, 0);
    assert.equal(f.repo.getCachedAvailability('tt0068646', 'US').offers.length, 1);
});

test('provider data stays visible without a valid options URL and ads retain their classification', async () => {
    const f = fixture({getWatchAvailability: async () => ({region: 'US', providers: [
        {id: 9, name: 'Prime Video', offer: 'stream'},
        {id: 9, name: 'Prime Video', offer: 'stream'},
        {id: 9, name: 'Prime Video', offer: 'rent'},
        {id: 2100, name: 'Prime Video Channel', offer: 'stream'},
        {id: 100, name: 'Free channel', offer: 'ads'},
    ], url: 'https://untrusted.example/watch'})});
    const value = await f.repo.getAvailability('tt0068646', 'US');
    assert.deepEqual(value.offers.map(offer => offer.type), ['subscription', 'rent', 'subscription', 'ads']);
    assert.equal(value.offers[0].url, undefined);
    assert.equal(value.offers[2].selectionId, 'tmdb:2100');
    assert.equal(streamingOfferSelected(value.offers[2], ['tmdb:9']), false);
});

test('old provider caches are ignored and invalid cache links cannot return', async () => {
    const store = storage();
    store.set('availability-v1', JSON.stringify([['tt0068646:US', availability()]]));
    const f = fixture({}, store);
    assert.equal(f.repo.getCachedAvailability('tt0068646', 'US'), null);
    const cached = parseStreamingAvailability(availability('US', [{...offer, url: 'https://www.netflix.com/title/1'}]), 'US');
    assert.equal(cached.offers.length, 1);
    assert.equal(cached.offers[0].url, undefined);
    assert.throws(() => parseStreamingAvailability(availability('US', [{...offer, serviceId: 'prime'}]), 'US'));
    assert.throws(() => parseStreamingAvailability(availability('IN'), 'US'));
});

test('persisted availability, country and service caches expire without extending their original age', async t => {
    t.mock.timers.enable({apis: ['Date'], now: Date.now()});
    const f = fixture();
    await f.repo.getCatalog('US');
    await f.repo.getAvailability('tt0068646', 'US');
    t.mock.timers.tick(86_400_000 - 1000);
    const restored = new StreamingRepositoryImpl(f.tmdb, f.store);
    await restored.getCatalog('US');
    assert.equal(f.calls.services.length, 1);
    t.mock.timers.tick(2000);
    assert.equal(restored.getCachedAvailability('tt0068646', 'US'), null);
    await restored.getCatalog('US');
    await restored.getAvailability('tt0068646', 'US');
    assert.equal(f.calls.services.length, 2);
    assert.equal(f.calls.regions, 2);
    assert.equal(f.calls.offers.length, 2);
});

test('corrupt persisted service data is replaced and storage failures do not block availability', async () => {
    const f = fixture();
    f.store.set('tmdb-catalog-v1', JSON.stringify({country: 'US', at: Date.now(), services: [{id: -1, name: 'bad'}]}));
    assert.equal((await f.repo.getCatalog('US')).status, 'ready');
    assert.equal(f.calls.services.length, 1);
    const brokenStore = {getString: () => {throw new Error('disk');}, set: () => {throw new Error('disk');}};
    const resilient = fixture({}, brokenStore);
    assert.equal((await resilient.repo.getCatalog('US')).status, 'ready');
    assert.equal((await resilient.repo.getAvailability('tt0068646', 'US')).status, 'ready');
});

test('native viewing links use the operating system with a browser fallback', async () => {
    const calls = [];
    let fail = false;
    const {openStreamingLink} = loadTypeScript('presentation/movies/components/openStreamingLink.ts', {
        'react-native': {Linking: {openURL: async url => {calls.push(['app', url]); if (fail) throw new Error('No handler');}}},
        'expo-web-browser': {openBrowserAsync: async url => calls.push(['browser', url])},
    });
    await openStreamingLink(offer.url);
    assert.deepEqual(calls.map(call => call[0]), ['app']);
    fail = true;
    await openStreamingLink(offer.url);
    assert.deepEqual(calls.map(call => call[0]), ['app', 'app', 'browser']);
    await assert.rejects(openStreamingLink('javascript:alert(1)'));
    assert.equal(calls.length, 3);
});

test('web viewing links open options without an opener or credentials handoff', async t => {
    const previous = global.window;
    const calls = [];
    global.window = {open: (...args) => calls.push(args)};
    t.after(() => {global.window = previous;});
    const {openStreamingLink} = loadTypeScript('presentation/movies/components/openStreamingLink.web.ts');
    await openStreamingLink(offer.url);
    assert.deepEqual(calls, [[offer.url, '_blank', 'noopener,noreferrer']]);
});
