const assert = require('node:assert/strict');
const {test} = require('node:test');
const {loadTypeScript} = require('./helpers/load-typescript.cjs');

const {StreamingRepositoryImpl, parseStreamingAvailability, parseStreamingCatalog, streamingBaseUrl} =
    loadTypeScript('data/repositories/StreamingRepositoryImpl.ts');
const {hasSelectedStreamingOffer, streamingOfferSelected, safeStreamingUrl} = loadTypeScript('domain/policies/streaming.ts');
const offer = {serviceId: 'prime', serviceName: 'Prime Video', selectionId: 'prime', type: 'subscription',
    url: 'https://www.primevideo.com/detail/example'};
const availability = (country = 'US', offers = [offer]) => ({country, status: 'ready', offers, checkedAt: Date.now()});
const catalog = {status: 'ready', countries: [{code: 'US', name: 'United States', services: [
    {id: 'prime', name: 'Prime Video'}, {id: 'apple:tvs.sbd.1000249', name: 'Channel', parentName: 'Apple TV'},
]}]};
const response = value => ({ok: true, json: async () => value});
function storage() {
    const saved = new Map();
    return {getString: key => saved.get(key), set: (key, value) => saved.set(key, value), delete: key => saved.delete(key)};
}

test('country and add-on identities remain distinct when deciding what is on my services', () => {
    assert.equal(hasSelectedStreamingOffer(availability(), 'US', ['prime']), true);
    assert.equal(hasSelectedStreamingOffer(availability(), 'IN', ['prime']), false);
    assert.equal(hasSelectedStreamingOffer({...availability(), status: 'unavailable'}, 'US', ['prime']), false);
    assert.equal(streamingOfferSelected({...offer, type: 'rent'}, ['prime']), false);
    assert.equal(streamingOfferSelected({...offer, type: 'buy'}, ['prime']), false);
    const addon = {...offer, type: 'addon', selectionId: 'prime:starz', addonName: 'Starz'};
    assert.equal(streamingOfferSelected(addon, ['prime']), false);
    assert.equal(streamingOfferSelected(addon, ['prime:starz']), true);
});

test('links reject credential-bearing, local, executable, and non-HTTPS destinations', () => {
    for (const url of ['javascript:alert(1)', 'http://www.netflix.com/title/1', 'https://user:secret@netflix.com/',
        'https://localhost/title/1', 'https://127.0.0.1/', 'https://[::1]/', 'https://example.internal/', 'https://netflix.com:1234/']) {
        assert.equal(safeStreamingUrl(url), undefined, url);
    }
    assert.equal(safeStreamingUrl('https://www.netflix.com/title/1'), 'https://www.netflix.com/title/1');
});

test('client validates country, service selections and direct-link responses', () => {
    assert.deepEqual(parseStreamingCatalog(catalog), catalog);
    assert.throws(() => parseStreamingCatalog({...catalog, countries: [...catalog.countries, ...catalog.countries]}));
    assert.throws(() => parseStreamingAvailability(availability('IN'), 'US'));
    assert.throws(() => parseStreamingAvailability(availability('US', [{...offer, selectionId: 'netflix'}]), 'US'));
    assert.throws(() => parseStreamingAvailability(availability('US', [{...offer, url: 'javascript:alert(1)'}]), 'US'));
    assert.throws(() => parseStreamingAvailability({...availability(), status: 'unsupported-country'}, 'US'));
});

test('title requests coalesce, persist, and remain separated by country', async () => {
    const store = storage();
    const calls = [];
    const fetcher = async url => {calls.push(url); return response(availability(new URL(url).searchParams.get('country')));};
    const repo = new StreamingRepositoryImpl(store, undefined, 'https://yify.expo.app/api/streaming', fetcher);
    const values = await Promise.all([repo.getAvailability('tt1234567', 'US'), repo.getAvailability('tt1234567', 'US')]);
    assert.equal(calls.length, 1);
    assert.deepEqual(values[0], values[1]);
    await repo.getAvailability('tt1234567', 'IN');
    assert.equal(calls.length, 2);
    const restored = new StreamingRepositoryImpl(store, undefined, undefined, fetcher);
    assert.equal(restored.getCachedAvailability('tt1234567', 'US').country, 'US');
    await restored.getAvailability('tt1234567', 'US');
    assert.equal(calls.length, 2);
});

test('expired persisted results never imply a current subscription match', () => {
    const store = storage();
    store.set('availability-v1', JSON.stringify([['tt1234567:US', {...availability(), checkedAt: Date.now() - 86_400_001}]]));
    assert.equal(new StreamingRepositoryImpl(store).getCachedAvailability('tt1234567', 'US'), null);
});

test('missing API or quota errors remain unavailable and are not saved as no offers', async () => {
    const store = storage();
    let calls = 0;
    const repo = new StreamingRepositoryImpl(store, undefined, undefined, async () => {
        calls++; return {ok: false, status: 429};
    });
    assert.equal((await repo.getAvailability('tt1234567', 'US')).status, 'unavailable');
    assert.equal(repo.getCachedAvailability('tt1234567', 'US'), null);
    assert.equal((await repo.getCatalog()).status, 'unavailable');
    assert.equal(calls, 2);
    assert.equal(store.getString('availability-v1'), undefined);
});

test('deadline covers a stalled response body and aborts the transport', async () => {
    let signal;
    const repo = new StreamingRepositoryImpl(storage(), undefined, undefined, async (_url, init) => {
        signal = init.signal;
        return {ok: true, json: () => new Promise(() => {})};
    }, 5);
    assert.equal((await repo.getCatalog()).status, 'unavailable');
    assert.equal(signal.aborted, true);
});

test('invalid title or country does not send a request', async () => {
    let calls = 0;
    const repo = new StreamingRepositoryImpl(storage(), undefined, undefined, async () => {calls++; return response(catalog);});
    await repo.getAvailability('../countries', 'US');
    await repo.getAvailability('tt1234567', 'us');
    assert.equal(calls, 0);
});

test('API endpoint works on native, hosted web, local preview and GitHub Pages', () => {
    assert.equal(streamingBaseUrl(undefined), 'https://yify.expo.app/api/streaming');
    assert.equal(streamingBaseUrl({origin: 'https://yify.expo.app', hostname: 'yify.expo.app', protocol: 'https:'}), 'https://yify.expo.app/api/streaming');
    assert.equal(streamingBaseUrl({origin: 'http://localhost:8081', hostname: 'localhost', protocol: 'http:'}), 'http://localhost:8081/api/streaming');
    assert.equal(streamingBaseUrl({origin: 'https://kunal26das.github.io', hostname: 'kunal26das.github.io', protocol: 'https:'}), 'https://yify.expo.app/api/streaming');
});

test('native viewing links use the official app link, falling back to a browser only if opening fails', async () => {
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

test('web viewing links open the official page without an opener or credentials handoff', async t => {
    const previous = global.window;
    const calls = [];
    global.window = {open: (...args) => calls.push(args)};
    t.after(() => {global.window = previous;});
    const {openStreamingLink} = loadTypeScript('presentation/movies/components/openStreamingLink.web.ts');
    await openStreamingLink(offer.url);
    assert.deepEqual(calls, [[offer.url, '_blank', 'noopener,noreferrer']]);
});

test('default deadline permits a cold lookup with two sequential upstream deadlines', async t => {
    t.mock.timers.enable({apis: ['setTimeout']});
    const repo = new StreamingRepositoryImpl(storage(), undefined, undefined, async () => {
        await new Promise(resolve => setTimeout(resolve, 16_000));
        return response(availability());
    });
    const pending = repo.getAvailability('tt1234567', 'US');
    await new Promise(resolve => setImmediate(resolve));
    t.mock.timers.tick(16_000);
    assert.equal((await pending).status, 'ready');
});
