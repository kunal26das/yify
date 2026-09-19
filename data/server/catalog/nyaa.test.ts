import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {setImmediate as nextTurn, setTimeout as delay} from 'node:timers/promises';
import {test} from 'node:test';

const require = createRequire(import.meta.url);
const {loadTypeScript} = require('../../../tests/helpers/load-typescript.cjs');
const nyaa = loadTypeScript('data/server/catalog/nyaa.ts');
const {parseNyaaFeed, nyaaFeedUrl, nyaaRetryAfterSeconds, createNyaaTransport, NyaaAnimeRepository, NyaaFeedError, NYAA_MAX_BYTES} = nyaa;
const {SubscriberAccessError} = loadTypeScript('data/server/subscribers/errors.ts');
const {createCatalogHandler} = loadTypeScript('data/server/catalog/handler.ts', {
    '../subscribers/errors': {SubscriberAccessError}, './nyaa': nyaa,
});
const {createCatalogRepositories} = loadTypeScript('data/server/catalog/repositories.ts', {'./nyaa': nyaa});
const {projectAnimeList} = loadTypeScript('data/server/catalog/projections.ts');
const HASH = '0123456789abcdef0123456789abcdef01234567';
const escape = (value: string) => value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');

// Fictional releases: no live feed, personal data, or upstream dependency in tests.
function item(id = 42, category = '1_2', title = '[Example] Moonlight Bakery - 03 [1080p]'): string {
    return `<item><title>${escape(title)}</title><link>https://nyaa.si/download/${id}.torrent</link>
        <guid isPermaLink="true">https://nyaa.si/view/${id}</guid><pubDate>Sat, 19 Sep 2026 03:21:58 -0000</pubDate>
        <nyaa:seeders>30</nyaa:seeders><nyaa:leechers>5</nyaa:leechers><nyaa:downloads>200</nyaa:downloads>
        <nyaa:infoHash>${HASH}</nyaa:infoHash><nyaa:categoryId>${category}</nyaa:categoryId>
        <nyaa:category>Anime - English-translated</nyaa:category><nyaa:size>320.5 MiB</nyaa:size>
        <nyaa:comments>0</nyaa:comments><nyaa:trusted>No</nyaa:trusted><nyaa:remake>No</nyaa:remake>
        <description><![CDATA[<a href="https://nyaa.si/view/${id}">A fictional release</a> | ${HASH}]]></description></item>`;
}
const feed = (...items: string[]) => `<rss xmlns:nyaa="https://nyaa.si/xmlns/nyaa" version="2.0"><channel>
    <title>Example feed</title><link>https://nyaa.si/</link>${items.join('')}</channel></rss>`;
const response = (xml = feed(item())) => new Response(xml, {headers: {'content-type': 'application/rss+xml; charset=utf-8', 'cache-control': 'no-store'}});
const request = (query = '', signal?: AbortSignal) => new Request(`https://yify.expo.app/api/subscriber-catalog/anime?${query}`, {signal});
const subscriber = {authorize: async () => ({uid: 'verified'})};

function deferred<T>() {
    let resolve!: (value: T) => void;
    const promise = new Promise<T>(yes => { resolve = yes; });
    return {promise, resolve};
}

test('Nyaa RSS produces namespaced releases and preserves structured source fields only in separate records', () => {
    const parsed = parseNyaaFeed(feed(item()));
    assert.deepEqual(parsed.releases, [{id: 'nyaa:42', title: '[Example] Moonlight Bakery - 03 [1080p]',
        category: 'english', uploadedAt: new Date('2026-09-19T03:21:58Z'), size: '320.5 MiB', seeds: 30, peers: 5, downloadCount: 200}]);
    assert.equal(parsed.records[0].infoHash, HASH);
    assert.equal(parsed.records[0].link, 'https://nyaa.si/download/42.torrent');
    assert.equal(parsed.records[0].seeders, '30');
    assert.equal(parsed.records[0].trusted, 'No');
    assert.match(parsed.records[0].description, /<a href=/);
    assert.doesNotMatch(JSON.stringify(parsed.releases), /infoHash|\.torrent|description|trusted|magnet/);
});

test('Nyaa category selection excludes other media, filters the selected subtype and deduplicates upload IDs', () => {
    const xml = feed(item(42), item(42), item(43, '1_3'), item(44, '1_4'), item(45, '1_1'), item(46, '2_1'));
    const parsed = parseNyaaFeed(xml);
    assert.deepEqual(parsed.releases.map((value: {id: string}) => value.id), ['nyaa:42', 'nyaa:43', 'nyaa:44', 'nyaa:45']);
    assert.equal(parsed.records.length, 4);
    assert.deepEqual(parseNyaaFeed(xml, 'raw').releases.map((value: {id: string}) => value.id), ['nyaa:44']);
    assert.deepEqual(parseNyaaFeed(feed()), {releases: [], records: []});
});

test('Nyaa RSS accepts namespaced aliases and escaped multilingual titles', () => {
    const parsed = parseNyaaFeed(feed(item(42, '1_3', 'パン屋 & <Example>')).replaceAll('nyaa:', 'n:').replace('xmlns:nyaa=', 'xmlns:n='));
    assert.equal(parsed.releases[0].title, 'パン屋 & <Example>');
});

test('malformed, dangerous, oversized or structurally ambiguous XML is rejected', () => {
    const valid = feed(item());
    const bad = [
        '', '<html><body>Challenge</body></html>', valid.replace('</item>', ''), valid + '<extra/>',
        valid.replace('version="2.0"', 'version="1.0"'), valid.replace('<channel>', '<channel xmlns="https://other.invalid">'),
        valid.replace('https://nyaa.si/xmlns/nyaa', 'https://untrusted.invalid/nyaa'),
        '<!DOCTYPE rss [<!ENTITY private SYSTEM "file:///etc/passwd">]>' + valid,
        '<!ENTITY x "secret">' + valid, valid.replace('Moonlight', '&missing; Moonlight'),
        valid.replace('<title>[Example]', '<title><nested/>[Example]'),
        valid.replace('</channel>', '</channel><channel/>'),
        valid.replace('<nyaa:seeders>30</nyaa:seeders>', '<nyaa:seeders>30</nyaa:seeders><nyaa:seeders>30</nyaa:seeders>'),
        valid.replace('320.5 MiB', 'x'.repeat(NYAA_MAX_BYTES)),
        feed(...Array.from({length: 76}, (_, index) => item(index + 1))),
    ];
    for (const xml of bad) assert.throws(() => parseNyaaFeed(xml), /temporarily unavailable/);
});

test('invalid IDs, dates, counters and download destinations cannot become a parsed record', () => {
    for (const [before, after] of [
        ['/view/42', '/view/0'], ['/view/42', '/view/9007199254740992'], ['/download/42.torrent', '/download/43.torrent'],
        ['https://nyaa.si/download/42.torrent', 'https://other.invalid/download/42.torrent'],
        [HASH, 'not-an-info-hash'], ['>30</nyaa:seeders>', '>-1</nyaa:seeders>'],
        ['>30</nyaa:seeders>', '>1.5</nyaa:seeders>'], ['>30</nyaa:seeders>', '>9007199254740992</nyaa:seeders>'],
        ['Sat, 19 Sep 2026 03:21:58 -0000', 'not-a-date'], ['320.5 MiB', 'magnet:?xt=urn:btih:x'],
        ['<nyaa:trusted>No</nyaa:trusted>', '<nyaa:trusted>Maybe</nyaa:trusted>'],
    ]) assert.throws(() => parseNyaaFeed(feed(item()).replace(before, after)), /temporarily unavailable/);
});

test('only fixed HTTPS RSS URLs and supported categories can be requested', () => {
    for (const [category, code] of [['all', '1_0'], ['english', '1_2'], ['non-english', '1_3'], ['raw', '1_4'], ['music-video', '1_1']]) {
        const url = new URL(nyaaFeedUrl({query: '  Moon & stars  ', category}));
        assert.equal(url.origin, 'https://nyaa.si');
        assert.equal(url.pathname, '/');
        assert.equal(url.searchParams.get('page'), 'rss');
        assert.equal(url.searchParams.get('q'), 'Moon & stars');
        assert.equal(url.searchParams.get('c'), code);
        assert.equal(url.searchParams.size, 3);
    }
    for (const params of [{category: 'other'}, {query: 'x'.repeat(201)}, {query: 'x\u0000y'}, {query: 12}]) {
        assert.throws(() => nyaaFeedUrl(params));
    }
});

test('public anime projection strips embedded links, hashes, markup and unknown fields', () => {
    const title = `Safe magnet:?xt=urn:btih:${HASH} ${encodeURIComponent('https://nyaa.si/download/42.torrent')} ${HASH} <b>end</b>`;
    const parsed = parseNyaaFeed(feed(item(42, '1_2', title)));
    const result = projectAnimeList({releases: [{...parsed.releases[0], raw: parsed.records[0], url: 'secret'}], limit: 999});
    assert.deepEqual(result, {releases: [{id: 'nyaa:42', title: 'Safe end', category: 'english',
        uploadedAt: '2026-09-19T03:21:58.000Z', size: '320.5 MiB', seeds: 30, peers: 5, downloadCount: 200}], limit: 75});
    assert.doesNotMatch(JSON.stringify(result), /magnet|torrent|012345|infoHash|secret|<b>/);
    assert.equal(projectAnimeList({releases: [{...parsed.releases[0], title: 'a'.repeat(1000)}]}).releases[0].title.length, 500);
    assert.deepEqual(projectAnimeList({releases: [{...parsed.releases[0], title: `magnet:?xt=urn:btih:${HASH}`}]}), {releases: [], limit: 75});
});

test('anime projection normalizes multiline XML titles without changing captured source records', () => {
    for (const [xmlTitle, originalTitle] of [
        ['Moon\nBakery\tEpisode', 'Moon\nBakery\tEpisode'],
        ['Moon&#13;&#10;Bakery&#9;Episode', 'Moon\r\nBakery\tEpisode'],
    ]) {
        const parsed = parseNyaaFeed(feed(item(42, '1_2', 'PLACEHOLDER')).replace('PLACEHOLDER', xmlTitle));
        const result = projectAnimeList({releases: parsed.releases, limit: 75});
        assert.equal(result.releases[0].title, 'Moon Bakery Episode');
        assert.equal(parsed.records[0].title, originalTitle);
        assert.equal(parsed.releases[0].title, originalTitle);
        assert.doesNotMatch(result.releases[0].title, /[\u0000-\u001f\u007f]/);
    }
});

test('RSS transport coalesces only pending work and never stores completed feed responses', async () => {
    let calls = 0;
    const wait = deferred<Response>();
    const transport = createNyaaTransport({spacingMs: 0, fetch: async (url: string, init: RequestInit) => {
        calls++;
        assert.equal(url, 'https://nyaa.si/?page=rss&c=1_0');
        assert.equal(init.redirect, 'manual');
        assert.equal(init.cache, undefined);
        assert.equal(Object.hasOwn(init, 'cache'), false);
        assert.equal((init.headers as Record<string, string>)['Cache-Control'], 'no-store');
        assert.ok(init.signal instanceof AbortSignal);
        return calls === 1 ? wait.promise : response();
    }});
    const first = transport.load({});
    const second = transport.load({});
    await nextTurn();
    assert.equal(calls, 1);
    wait.resolve(response());
    assert.deepEqual(await first, await second);
    await transport.load({});
    assert.equal(calls, 2);
});

test('requests for different searches are paced instead of hitting RSS together', async t => {
    t.mock.timers.enable({apis: ['setTimeout']});
    let now = 1000;
    let calls = 0;
    const transport = createNyaaTransport({spacingMs: 30, now: () => now, fetch: async () => { calls++; return response(); }});
    await transport.load({query: 'Moon'});
    const second = transport.load({query: 'Bakery'});
    await nextTurn();
    assert.equal(calls, 1);
    now += 30;
    t.mock.timers.tick(30);
    await second;
    assert.equal(calls, 2);
});

test('Retry-After accepts bounded numeric values and valid HTTP dates without shortening long waits', () => {
    const now = Date.UTC(2026, 8, 19, 0, 0, 0, 250);
    assert.equal(nyaaRetryAfterSeconds('0', now), 0);
    assert.equal(nyaaRetryAfterSeconds(' 00120 ', now), 120);
    assert.equal(nyaaRetryAfterSeconds('86400', now), 86400);
    assert.equal(nyaaRetryAfterSeconds(new Date(now + 86_400_000).toUTCString(), now), 86400);
    assert.equal(nyaaRetryAfterSeconds(new Date(now + 2000).toUTCString(), now), 2);
    assert.equal(nyaaRetryAfterSeconds(new Date(now - 2000).toUTCString(), now), 0);
    for (const header of [null, '', '   ', '-1', '+1', '1.5', 'Infinity', 'unavailable',
        '9007199254740992', '9'.repeat(129), '2026-09-20T00:00:00.000Z',
        'Sat, 31 Feb 2026 00:00:00 GMT', 'Fri, 19 Sep 2026 00:00:00 GMT']) {
        assert.equal(nyaaRetryAfterSeconds(header, now), 60);
    }
});

test('source rate limits suppress every query until the full cooldown expires, then fetching resumes uncached', async () => {
    let now = 1000;
    let calls = 0;
    const transport = createNyaaTransport({spacingMs: 0, now: () => now, fetch: async () => {
        calls++;
        return calls === 1 ? new Response('PRIVATE_SOURCE_BODY', {status: 429, headers: {'Retry-After': '3600'}}) : response();
    }});
    await assert.rejects(transport.load({query: 'first'}), failure => {
        assert.equal(failure instanceof NyaaFeedError, true);
        assert.equal(failure.code, 'rate_limited');
        assert.equal(failure.upstreamStatus, 429);
        assert.equal(failure.retryAfterSeconds, 3600);
        assert.doesNotMatch(failure.message, /PRIVATE_SOURCE_BODY/);
        return true;
    });
    now += 1000;
    for (const params of [{query: 'first'}, {query: 'another'}, {category: 'raw'}, {}]) {
        await assert.rejects(transport.load(params), {code: 'rate_limited', retryAfterSeconds: 3599});
    }
    assert.equal(calls, 1);
    now += 3_599_000;
    assert.equal((await transport.load({category: 'english'})).releases.length, 1);
    assert.equal(calls, 2);
    await transport.load({category: 'english'});
    assert.equal(calls, 3, 'successful RSS remains uncached after rate-limit recovery');
});

test('missing or invalid Retry-After creates a one-minute cooldown shared by all feed queries', async () => {
    for (const header of [undefined, 'not-a-time', '-300']) {
        let now = 1000;
        let calls = 0;
        const transport = createNyaaTransport({spacingMs: 0, now: () => now, fetch: async () => {
            calls++;
            return calls === 1 ? new Response('unavailable', {status: 429,
                headers: header === undefined ? {} : {'Retry-After': header}}) : response();
        }});
        await assert.rejects(transport.load({}), {code: 'rate_limited', retryAfterSeconds: 60});
        now += 59_000;
        await assert.rejects(transport.load({query: 'new search'}), {code: 'rate_limited', retryAfterSeconds: 1});
        assert.equal(calls, 1);
        now += 1000;
        await transport.load({query: 'new search'});
        assert.equal(calls, 2);
    }
});

test('a source cooldown also prevents already queued paced requests from fetching', async t => {
    t.mock.timers.enable({apis: ['setTimeout']});
    let now = 1000;
    let calls = 0;
    const upstream = deferred<Response>();
    const transport = createNyaaTransport({spacingMs: 5000, now: () => now, fetch: async () => {
        calls++;
        return upstream.promise;
    }});
    const first = assert.rejects(transport.load({query: 'first'}), {code: 'rate_limited', retryAfterSeconds: 120});
    await nextTurn();
    assert.equal(calls, 1);
    const second = assert.rejects(transport.load({query: 'second'}), {code: 'rate_limited', retryAfterSeconds: 115});
    const third = assert.rejects(transport.load({query: 'third'}), {code: 'rate_limited', retryAfterSeconds: 115});
    await nextTurn();
    upstream.resolve(new Response('PRIVATE_SOURCE_BODY', {status: 429, headers: {'Retry-After': '120'}}));
    await first;
    now += 5000;
    t.mock.timers.tick(5000);
    await Promise.all([second, third]);
    assert.equal(calls, 1);
});

test('authorized subscriber API returns safe 429 diagnostics and Retry-After during source cooldown', async () => {
    let calls = 0;
    let authorized = 0;
    const sourceFetch = async () => {
        calls++;
        return new Response('PRIVATE_SOURCE_BODY https://private-upstream.invalid/?token=PRIVATE_TOKEN', {
            status: 429, headers: {'Retry-After': '120'},
        });
    };
    const handler = createCatalogHandler((signal: AbortSignal, onResponse?: (body: unknown) => void) =>
        createCatalogRepositories({}, {signal, onResponse, fetch: sourceFetch}),
    {subscriber: {authorize: async () => {authorized++; return {uid: 'verified'}; }}});
    for (const query of ['', 'query=another&category=english']) {
        const result = await handler(request(query), 'anime');
        assert.equal(result.status, 429);
        assert.equal(result.headers.get('X-Catalog-Error-Code'), 'anime_rate_limited');
        assert.equal(result.headers.get('X-Catalog-Upstream-Status'), '429');
        const waitSeconds = Number(result.headers.get('Retry-After'));
        assert.ok(waitSeconds > 0 && waitSeconds <= 120);
        assert.equal(result.headers.get('Cache-Control'), 'private, no-store');
        const body = await result.json();
        assert.deepEqual(body, {error: 'Anime uploads are temporarily unavailable. Please try again later.'});
        assert.doesNotMatch(JSON.stringify([Object.fromEntries(result.headers), body]), /PRIVATE_|private-upstream|"raw"/);
    }
    assert.equal(calls, 1);
    assert.equal(authorized, 2);
});

test('one cancelled reader cannot cancel a shared request for another reader', async () => {
    const wait = deferred<Response>();
    let upstream: AbortSignal | undefined;
    const transport = createNyaaTransport({spacingMs: 0, fetch: async (_url: string, init: RequestInit) => {
        upstream = init.signal!; return wait.promise;
    }});
    const firstController = new AbortController();
    const first = transport.load({}, firstController.signal);
    const second = transport.load({});
    await nextTurn();
    firstController.abort();
    await assert.rejects(first, {name: 'AbortError'});
    assert.equal(upstream?.aborted, false);
    wait.resolve(response());
    assert.equal((await second).releases[0].id, 'nyaa:42');
});

test('all cancelled readers abort upstream and a cancelled queued request never fetches', async () => {
    let calls = 0;
    let upstream: AbortSignal | undefined;
    const transport = createNyaaTransport({spacingMs: 50, fetch: async (_url: string, init: RequestInit) => {
        calls++; upstream = init.signal!;
        return new Promise<Response>(() => {});
    }});
    const controller = new AbortController();
    const first = transport.load({}, controller.signal);
    await nextTurn();
    controller.abort();
    await assert.rejects(first, {name: 'AbortError'});
    assert.equal(upstream?.aborted, true);
    const queuedController = new AbortController();
    const second = transport.load({query: 'other'}, queuedController.signal);
    queuedController.abort();
    await assert.rejects(second, {name: 'AbortError'});
    await delay(60);
    assert.equal(calls, 1);
});

test('already-cancelled requests and timeouts do not leave an uncancellable fetch running', async () => {
    let calls = 0;
    let upstream: AbortSignal | undefined;
    const transport = createNyaaTransport({spacingMs: 0, timeoutMs: 5, fetch: async (_url: string, init: RequestInit) => {
        calls++; upstream = init.signal!;
        return new Promise<Response>(() => {});
    }});
    const controller = new AbortController(); controller.abort();
    await assert.rejects(transport.load({}, controller.signal), {name: 'AbortError'});
    assert.equal(calls, 0);
    await assert.rejects(transport.load({}), {name: 'AbortError'});
    assert.equal(upstream?.aborted, true);
});

test('HTML, redirects, HTTP failures, invalid UTF-8 and oversized streamed RSS are rejected', async () => {
    const redirected = response();
    Object.defineProperty(redirected, 'redirected', {value: true});
    let cancelled = false;
    const oversized = new Response(new ReadableStream({
        start(controller) { controller.enqueue(new Uint8Array(NYAA_MAX_BYTES + 1)); },
        cancel() { cancelled = true; },
    }), {headers: {'content-type': 'application/rss+xml'}});
    for (const upstream of [
        new Response('<html/>', {headers: {'content-type': 'text/html'}}), redirected,
        new Response(null, {status: 302, headers: {Location: 'https://unexpected.invalid/feed'}}),
        new Response('temporarily unavailable', {status: 503}),
        new Response(new Uint8Array([0xff]), {headers: {'content-type': 'application/rss+xml'}}),
        new Response('x', {headers: {'content-length': String(NYAA_MAX_BYTES + 1)}}), oversized,
    ]) {
        const transport = createNyaaTransport({spacingMs: 0, fetch: async () => upstream});
        await assert.rejects(transport.load({}));
    }
    assert.equal(cancelled, true);
});

test('subscriber Anime diagnostics expose only known transport classifications and validated upstream status', async () => {
    const secret = 'PRIVATE_UPSTREAM_DETAIL https://upstream.invalid/?token=private-token';
    const cases: {code: string; status: string | null; fetch: () => Promise<Response>}[] = [
        {code: 'http_error', status: '503', fetch: async () => new Response(secret, {status: 503})},
        {code: 'response_type', status: '200', fetch: async () => new Response(secret, {headers: {'content-type': 'text/html'}})},
        {code: 'invalid_feed', status: null, fetch: async () => response(`<rss>${secret}</rss>`)},
        {code: 'fetch_failed', status: null, fetch: async () => { throw new Error(secret); }},
        {code: 'read_failed', status: null, fetch: async () => new Response(new ReadableStream({
            start(controller) { controller.error(new Error(secret)); },
        }), {headers: {'content-type': 'application/rss+xml'}})},
    ];
    for (const entry of cases) {
        const handler = createCatalogHandler((signal: AbortSignal) =>
            createCatalogRepositories({}, {signal, fetch: entry.fetch}), {subscriber});
        const result = await handler(request(), 'anime');
        assert.equal(result.status, 502);
        assert.equal(result.headers.get('X-Catalog-Error-Code'), `anime_${entry.code}`);
        assert.equal(result.headers.get('X-Catalog-Upstream-Status'), entry.status);
        assert.equal(result.headers.get('Cache-Control'), 'private, no-store');
        const body = await result.json();
        assert.deepEqual(body, {error: 'Catalog is temporarily unavailable'});
        assert.doesNotMatch(JSON.stringify([Object.fromEntries(result.headers), body]),
            /PRIVATE_UPSTREAM_DETAIL|upstream\.invalid|private-token/);
    }
});

test('non-typed or spoofed errors cannot inject Anime diagnostic headers or public details', async () => {
    for (const failure of [
        new Error('PRIVATE_ERROR_MESSAGE'),
        Object.assign(new Error('PRIVATE_ERROR_MESSAGE'), {
            name: 'NyaaFeedError', code: 'PRIVATE_ERROR_CODE', upstreamStatus: 'PRIVATE_STATUS',
        }),
        {name: 'NyaaFeedError', code: 'PRIVATE_ERROR_CODE', message: 'PRIVATE_ERROR_MESSAGE', upstreamStatus: 503},
        'PRIVATE_ERROR_MESSAGE',
    ]) {
        const handler = createCatalogHandler({movies: {}, shows: {}, anime: {
            async listAnime() { throw failure; },
        }}, {subscriber});
        const result = await handler(request(), 'anime');
        assert.equal(result.status, 502);
        assert.equal(result.headers.has('X-Catalog-Error-Code'), false);
        assert.equal(result.headers.has('X-Catalog-Upstream-Status'), false);
        const body = await result.json();
        assert.deepEqual(body, {error: 'Catalog is temporarily unavailable'});
        assert.doesNotMatch(JSON.stringify([Object.fromEntries(result.headers), body]), /PRIVATE_/);
    }
});

test('fetch runtime classification exposes only fixed codes without source error messages', async () => {
    const privateUrl = 'https://private-upstream.invalid/?token=PRIVATE_TOKEN';
    for (const [message, code] of [
        ['Redirect encountered with redirect mode error', 'fetch_redirect'],
        ['Unsupported cache option', 'fetch_cache'],
        ['I/O cannot be performed on behalf of a different request', 'fetch_context'],
        ['DNS resolution failed', 'fetch_dns'],
        ['TLS connection failed with an invalid certificate', 'fetch_network'],
        ['Illegal invocation', 'fetch_runtime'],
        ['Unknown upstream failure', 'fetch_failed'],
    ]) {
        const handler = createCatalogHandler((signal: AbortSignal) => createCatalogRepositories({}, {
            signal,
            fetch: async () => { throw new TypeError(`${message}: ${privateUrl}`); },
        }), {subscriber});
        const result = await handler(request(), 'anime');
        assert.equal(result.status, 502);
        assert.equal(result.headers.get('X-Catalog-Error-Code'), `anime_${code}`);
        assert.equal(result.headers.has('X-Catalog-Upstream-Status'), false);
        const body = await result.json();
        assert.deepEqual(body, {error: 'Catalog is temporarily unavailable'});
        const publicResponse = JSON.stringify([Object.fromEntries(result.headers), body]);
        assert.equal(publicResponse.includes(message), false);
        assert.doesNotMatch(publicResponse, /private-upstream|PRIVATE_TOKEN/);
    }
    for (const error of ['redirect cache DNS PRIVATE_TOKEN', {message: 'network PRIVATE_TOKEN'}]) {
        const transport = createNyaaTransport({spacingMs: 0, fetch: async () => { throw error; }});
        await assert.rejects(transport.load({}), failure => {
            assert.equal(failure instanceof NyaaFeedError, true);
            assert.equal(failure.code, 'fetch_failed');
            assert.doesNotMatch(failure.message, /PRIVATE_TOKEN|redirect|network/);
            return true;
        });
    }
});

test('typed Nyaa failures do not add Anime diagnostics to other catalog operations', async () => {
    const handler = createCatalogHandler({movies: {
        async getMovieDetails() { throw new NyaaFeedError('http_error', 503); },
    }, shows: {}});
    const result = await handler(new Request('https://yify.expo.app/api/catalog/movie?id=42'), 'movie');
    assert.equal(result.status, 502);
    assert.equal(result.headers.has('X-Catalog-Error-Code'), false);
    assert.equal(result.headers.has('X-Catalog-Upstream-Status'), false);
    assert.deepEqual(await result.json(), {error: 'Catalog is temporarily unavailable'});
});

test('request validation rejects paging, arbitrary upstream URLs and unbounded search before repository access', async () => {
    let calls = 0;
    const handler = createCatalogHandler(() => { calls++; return {}; });
    for (const query of ['page=2', 'limit=100', 'category=audio', 'category=all&category=raw', 'raw=true',
        'url=https://other.invalid', 'query=' + 'x'.repeat(201), 'query=x%00y', 'v=3']) {
        assert.equal((await handler(request(query), 'anime')).status, 400);
    }
    assert.equal(calls, 0);
});

test('public anime requests cannot initialize the source, even with a claimed subscriber header', async () => {
    let created = 0;
    const handler = createCatalogHandler(() => { created++; throw new Error('Unexpected source access'); });
    for (const headers of [{}, {Authorization: 'Bearer claim'}]) {
        const result = await handler(new Request('https://yify.expo.app/api/catalog/anime?category=english&query=Moon&v=2', {headers}), 'anime');
        assert.equal(result.status, 403);
        assert.equal(result.headers.get('cache-control'), 'no-store');
        assert.deepEqual(await result.json(), {error: 'An active subscription is required'});
    }
    assert.equal(created, 0);
});

test('subscriber anime capture starts after authorization and returns the matching structured originals', async () => {
    let authorized = false;
    const handler = createCatalogHandler((signal: AbortSignal, onResponse: (body: unknown) => void) => {
        assert.equal(authorized, true);
        return createCatalogRepositories({}, {signal, onResponse, fetch: async () => {
            assert.equal(authorized, true); return response();
        }});
    }, {subscriber: {authorize: async () => { authorized = true; return {uid: 'verified'}; }}});
    const result = await handler(request('v=2'), 'anime');
    assert.equal(result.status, 200);
    assert.equal(result.headers.get('cache-control'), 'private, no-store');
    assert.equal(result.headers.get('cdn-cache-control'), 'no-store');
    assert.equal(result.headers.get('vary'), 'Authorization');
    const body = await result.json();
    assert.equal(body.metadata.releases[0].id, 'nyaa:42');
    assert.equal(body.raw.responses.length, 1);
    assert.equal(body.raw.responses[0].source, 'nyaa');
    assert.equal(body.raw.responses[0].items[0].infoHash, HASH);
    assert.equal(body.raw.responses[0].items[0].link, 'https://nyaa.si/download/42.torrent');
    assert.doesNotMatch(JSON.stringify(body.metadata), /012345|\.torrent|infoHash|description|https:/);
});

test('failed subscriber authorization never creates a Nyaa repository or makes an upstream call', async () => {
    for (const status of [401, 403, 503]) {
        let created = false;
        const handler = createCatalogHandler(() => { created = true; throw new Error('Unexpected'); }, {
            subscriber: {authorize: async () => { throw new SubscriberAccessError(status); }},
        });
        const result = await handler(request(), 'anime');
        assert.equal(result.status, status);
        assert.equal(created, false);
    }
});

test('cancellation after transport completion cannot publish an original response', async () => {
    const controller = new AbortController();
    let captured = false;
    const repository = new NyaaAnimeRepository({signal: controller.signal, onResponse: () => { captured = true; }, transport: {
        async load() { controller.abort(); return parseNyaaFeed(feed(item())); },
    }});
    await assert.rejects(repository.listAnime({}), {name: 'AbortError'});
    assert.equal(captured, false);
});
