import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {test} from 'node:test';

const require = createRequire(import.meta.url);
const {loadTypeScript} = require('../../../tests/helpers/load-typescript.cjs');
const http = loadTypeScript('data/server/streaming/http.ts');
const {createStreamingHandler} = loadTypeScript('data/server/streaming/handler.ts', {'./http': http});
const {createStreamingProvider} = loadTypeScript('data/server/streaming/provider.ts', {'./http': http});
const {normalizeStreamingCatalog, normalizeStreamingOffers} = loadTypeScript('data/server/streaming/normalization.ts');
const fixtures = JSON.parse(readFileSync(new URL('./fixtures.json', import.meta.url), 'utf8'));
const DAY = 86_400_000;
const origin = 'https://yify.expo.app';
const key = 'private-test-api-key';
const json = (value: unknown, status = 200, headers = {}) => new Response(JSON.stringify(value), {status, headers: {'Content-Type': 'application/json', ...headers}});
const request = (operation = 'title', query = 'imdbId=tt0068646&country=IN', method = 'GET', headers = {}) => new Request(`${origin}/api/streaming/${operation}${query ? `?${query}` : ''}`, {method, headers});

function setup(options: Record<string, unknown> = {}) {
    const calls: {url: string; init: RequestInit}[] = [];
    const provider = createStreamingProvider({apiKey: () => key, now: () => 1_700_000_000_000,
        fetcher: async (url: string, init: RequestInit) => {
            calls.push({url, init});
            return json(url.endsWith('/countries') ? fixtures.countries : fixtures.title);
        }, ...options});
    return {provider, calls, handler: createStreamingHandler(provider, {now: options.now ?? (() => 1_700_000_000_000)})};
}

test('official country and title shapes preserve country differences, add-ons and paid offers', async () => {
    const {handler, calls} = setup();
    const countries = await (await handler(request('countries', ''), 'countries')).json();
    assert.equal(countries.status, 'ready');
    assert.deepEqual(countries.countries.map((country: {code: string}) => country.code), ['IN', 'GB', 'US']);
    assert.ok(countries.countries.find((country: {code: string}) => country.code === 'US').services.some((service: {id: string}) => service.id === 'apple:tvs.sbd.1000230'));
    const india = await (await handler(request(), 'title')).json();
    const usa = await (await handler(request('title', 'imdbId=tt0068646&country=US'), 'title')).json();
    assert.deepEqual(india.offers.map((offer: {selectionId: string}) => offer.selectionId), ['hotstar']);
    assert.ok(usa.offers.some((offer: {selectionId: string; type: string}) => offer.selectionId === 'apple:tvs.sbd.1000230' && offer.type === 'addon'));
    assert.ok(usa.offers.some((offer: {selectionId: string; type: string; price: string}) => offer.selectionId === 'apple' && offer.type === 'rent' && offer.price === '3.99 USD'));
    assert.equal(calls.length, 3);
    assert.equal(calls[0].init.headers['X-API-Key'], key);
    assert.equal(calls[0].url, 'https://api.movieofthenight.com/v4/countries');
    assert.match(calls[1].url, /\/shows\/tt0068646\?country=in&series_granularity=show$/);
    assert.equal(calls[0].init.redirect, 'manual');
    assert.ok(!JSON.stringify([countries, india, usa]).includes(key));
    assert.ok(!JSON.stringify(usa).includes('imageSet'));
});

test('free offers stay free and malformed add-ons cannot masquerade as a base subscription', () => {
    const catalog = normalizeStreamingCatalog(fixtures.countries);
    const title = structuredClone(fixtures.title);
    title.streamingOptions.in[0].type = 'free';
    assert.equal(normalizeStreamingOffers(title, 'IN', catalog)[0].type, 'free');
    title.streamingOptions.in[0].type = 'addon';
    assert.throws(() => normalizeStreamingOffers(title, 'IN', catalog));
});

for (const link of ['javascript:alert(1)', 'http://www.hotstar.com/title', 'magnet:?xt=bad', 'https://user:password@www.hotstar.com/title',
    'https://127.0.0.1/title', 'https://localhost/title', 'https://hotstar.com.evil.com/title', 'https://evil.com/title', 'https://hotstar.com:444/title']) {
    test(`reject unsafe offer link ${link}`, () => {
        const title = structuredClone(fixtures.title);
        title.streamingOptions.in[0].link = link;
        assert.throws(() => normalizeStreamingOffers(title, 'IN', normalizeStreamingCatalog(fixtures.countries)));
    });
}

for (const query of ['', 'imdbId=tt0068646', 'imdbId=tt000&country=IN', 'imdbId=../secret&country=IN', 'imdbId=tt1&country=ZZZ',
    'imdbId=tt1&country=IN&country=US', 'imdbId=tt1&country=IN&apiKey=secret', 'imdbId=tt1&country=IN&url=https://evil.com', `imdbId=tt${'1'.repeat(300)}&country=IN`]) {
    test(`invalid input consumes no provider requests: ${query.slice(0, 80)}`, async () => {
        const {handler, calls} = setup();
        const response = await handler(request('title', query), 'title');
        assert.equal(response.status, 400);
        assert.equal(response.headers.get('Cache-Control'), 'no-store');
        assert.equal(calls.length, 0);
    });
}

test('unsupported countries and title absence are distinct from service failure', async () => {
    const {handler, calls} = setup();
    const unsupported = await handler(request('title', 'imdbId=tt1&country=ZZ'), 'title');
    assert.deepEqual(await unsupported.json(), {country: 'ZZ', status: 'unsupported-country', offers: []});
    assert.equal(unsupported.headers.get('CDN-Cache-Control'), 'no-store');
    assert.equal(calls.length, 1);
    const missing = setup({fetcher: async (url: string) => url.endsWith('/countries') ? json(fixtures.countries) : json({}, 404)});
    const absent = await missing.handler(request(), 'title');
    assert.equal(absent.status, 200);
    assert.equal((await absent.json()).status, 'ready');
    assert.match(absent.headers.get('Cache-Control')!, /s-maxage=86400/);
    const failedCatalog = setup({fetcher: async () => json({}, 404)});
    const failed = await failedCatalog.handler(request(), 'title');
    assert.equal(failed.status, 502);
    assert.equal((await failed.json()).status, 'unavailable');
});

test('a missing key is unavailable and is never cached as empty success', async () => {
    const {handler, calls} = setup({apiKey: () => undefined});
    for (const operation of ['countries', 'title']) {
        const response = await handler(request(operation, operation === 'countries' ? '' : 'imdbId=tt1&country=IN'), operation);
        assert.equal(response.status, 503);
        assert.equal((await response.json()).status, 'unavailable');
        assert.equal(response.headers.get('CDN-Cache-Control'), 'no-store');
    }
    assert.equal(calls.length, 0);
});

test('identical requests coalesce and cached titles outlive individual requests', async () => {
    const {handler, calls} = setup();
    const responses = await Promise.all(Array.from({length: 6}, () => handler(request(), 'title')));
    assert.ok(responses.every(response => response.status === 200));
    await handler(request(), 'title');
    assert.equal(calls.length, 2);
});

test('title cache refreshes after 24 hours while country cache lasts seven days', async () => {
    let time = DAY * 100;
    const {handler, calls} = setup({now: () => time});
    await handler(request(), 'title');
    time += DAY - 1;
    await handler(request(), 'title');
    assert.equal(calls.length, 2);
    time += 1;
    await handler(request(), 'title');
    assert.equal(calls.length, 3);
    time += 6 * DAY;
    await handler(request(), 'title');
    assert.equal(calls.length, 5);
});

test('bounded cache evicts old titles and keeps fresh results only', async () => {
    const {handler, calls} = setup({maximumCacheEntries: 3});
    for (const imdb of ['tt1', 'tt2', 'tt3', 'tt1']) await handler(request('title', `imdbId=${imdb}&country=IN`), 'title');
    assert.equal(calls.filter(call => call.url.endsWith('/countries')).length, 1);
    assert.equal(calls.length, 5);
});

for (const status of [401, 403, 429, 500, 503]) {
    test(`upstream ${status} is unavailable, is not CDN cached, and activates cooldown`, async () => {
        let count = 0;
        const {handler} = setup({fetcher: async () => {count++; return json({secret: key}, status, {'Retry-After': '120'});}});
        const first = await handler(request(), 'title');
        const second = await handler(request(), 'title');
        assert.equal(first.status, status === 429 ? 429 : 502);
        assert.equal((await first.json()).status, 'unavailable');
        assert.equal(first.headers.get('CDN-Cache-Control'), 'no-store');
        assert.equal(count, 1);
        assert.ok(!await second.text().then(value => value.includes(key)));
    });
}

test('per-instance upstream budget blocks only misses and resets the next day', async () => {
    let time = DAY * 100;
    const {handler, calls} = setup({now: () => time, maximumRequestsPerDay: 2});
    assert.equal((await handler(request(), 'title')).status, 200);
    assert.equal((await handler(request(), 'title')).status, 200);
    const denied = await handler(request('title', 'imdbId=tt2&country=IN'), 'title');
    assert.equal(denied.status, 429);
    assert.equal(calls.length, 2);
    time += DAY;
    assert.equal((await handler(request('title', 'imdbId=tt2&country=IN'), 'title')).status, 200);
    assert.equal(calls.length, 3);
});

test('upstream concurrency is bounded without retries or an unbounded waiting queue', async () => {
    let finish: () => void = () => {};
    const gate = new Promise<void>(resolve => {finish = resolve;});
    let titleCalls = 0;
    const {provider} = setup({maximumConcurrentRequests: 1, fetcher: async (url: string) => {
        if (url.endsWith('/countries')) return json(fixtures.countries);
        titleCalls++;
        await gate;
        return json(fixtures.title);
    }});
    await provider.getCatalog();
    const first = provider.getAvailability('tt1', 'IN');
    await new Promise(resolve => setImmediate(resolve));
    await assert.rejects(provider.getAvailability('tt2', 'IN'), (error: {status: number}) => error.status === 429);
    assert.equal(titleCalls, 1);
    finish();
    await first;
});

test('timeout bounds an unresponsive fetch even if it ignores cancellation', async () => {
    const {handler} = setup({timeoutMs: 10, fetcher: () => new Promise(() => {})});
    const response = await handler(request(), 'title');
    assert.equal(response.status, 504);
    assert.equal((await response.json()).status, 'unavailable');
});

test('timeout also bounds a response body that never completes and cancels the stream', async () => {
    let cancelled = false;
    const {handler} = setup({timeoutMs: 10, fetcher: async () => new Response(new ReadableStream({
        start(controller) {controller.enqueue(new TextEncoder().encode('{'));},
        cancel() {cancelled = true;},
    }), {headers: {'Content-Type': 'application/json'}})});
    const response = await handler(request(), 'title');
    assert.equal(response.status, 504);
    assert.equal(cancelled, true);
});

for (const body of [{}, [], {in: {countryCode: 'US', name: 'India', services: []}}, {in: {countryCode: 'in', name: 'India', services: 'invalid'}}]) {
    test(`malformed country data is unavailable: ${JSON.stringify(body)}`, async () => {
        const {handler} = setup({fetcher: async () => json(body)});
        const response = await handler(request('countries', ''), 'countries');
        assert.equal(response.status, 502);
        assert.equal((await response.json()).status, 'unavailable');
    });
}

test('invalid JSON, oversized bodies and redirects cannot become a successful cache entry', async () => {
    for (const response of [new Response('{', {headers: {'Content-Type': 'application/json'}}), new Response('{}', {headers: {'Content-Type': 'application/json', 'Content-Length': '5000000'}}), new Response(null, {status: 302, headers: {Location: 'https://evil.com'}})]) {
        const {handler} = setup({fetcher: async () => response});
        const result = await handler(request(), 'title');
        assert.equal(result.status, 502);
        assert.equal(result.headers.get('Cache-Control'), 'no-store');
    }
});

test('admission limits client bursts before touching the provider and resets after one minute', async () => {
    let time = 0;
    let count = 0;
    const handler = createStreamingHandler({getCatalog: async () => {count++; return {status: 'ready', countries: []};}}, {now: () => time, maximumClientRequestsPerMinute: 1});
    assert.equal((await handler(request('countries', ''), 'countries')).status, 200);
    assert.equal((await handler(request('countries', ''), 'countries')).status, 429);
    assert.equal(count, 1);
    time += 60_000;
    assert.equal((await handler(request('countries', ''), 'countries')).status, 200);
});

test('GET/OPTIONS are supported without credentials; other methods and headers are rejected', async () => {
    const {handler, calls} = setup();
    const options = await handler(request('title', '', 'OPTIONS', {'Access-Control-Request-Method': 'GET'}), 'title');
    assert.equal(options.status, 204);
    assert.equal(options.headers.get('Access-Control-Allow-Origin'), '*');
    assert.equal((await handler(request('title', '', 'OPTIONS', {'Access-Control-Request-Headers': 'Authorization'}), 'title')).status, 400);
    assert.equal((await handler(request('countries', '', 'POST'), 'countries')).status, 405);
    assert.equal((await handler(request('countries', 'unexpected=1'), 'countries')).status, 400);
    assert.equal((await handler(request('unknown', ''), 'unknown')).status, 400);
    assert.equal(calls.length, 0);
});

test('CDN cache lifetime never extends an aged title beyond its original 24 hours', async () => {
    let time = DAY * 100;
    const {handler} = setup({now: () => time});
    await handler(request(), 'title');
    time += 23 * 60 * 60 * 1000;
    const response = await handler(request(), 'title');
    assert.equal(response.headers.get('CDN-Cache-Control'), 'public, max-age=3600');
});

test('cache byte budget bounds large entries without corrupting responses', async () => {
    const {provider, calls} = setup({maximumCacheBytes: 1});
    assert.equal((await provider.getCatalog()).status, 'ready');
    assert.equal((await provider.getCatalog()).status, 'ready');
    assert.equal(calls.length, 2);
});
