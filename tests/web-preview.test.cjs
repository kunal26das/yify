const assert = require('node:assert/strict');
const {createServer} = require('node:http');
const {once} = require('node:events');
const {spawn} = require('node:child_process');
const {test} = require('node:test');
const {loadTypeScript} = require('./helpers/load-typescript.cjs');

const checker = import('../scripts/check-web-preview.mjs');

async function preview(t, api) {
    const requests = [];
    const server = createServer(async (request, response) => {
        requests.push(request.url);
        const url = new URL(request.url, 'http://localhost');
        const title = {'/yify/': 'Yify', '/yify/movies': 'Browse Movies', '/yify/shows': 'Shows'}[url.pathname];
        if (title) {
            response.writeHead(200, {'content-type': 'text/html'});
            response.end(`<html><head><title>${title}</title></head><body>${title}</body></html>`);
            return;
        }
        const result = await api(new Request(url), url.pathname.split('/').at(-1));
        response.writeHead(result.status, Object.fromEntries(result.headers));
        response.end(await result.text());
    });
    server.listen(0, '127.0.0.1');
    await once(server, 'listening');
    t.after(() => new Promise(resolve => { server.close(resolve); server.closeAllConnections(); }));
    return {url: `http://127.0.0.1:${server.address().port}/yify/`, requests};
}

test('the static-only QA invocation reproduces catalog 404 and fails before browser navigation', async t => {
    const {checkWebPreview} = await checker;
    const server = await preview(t, () => new Response('Not Found', {status: 404}));
    let browserNavigated = false;
    await assert.rejects(async () => {
        await checkWebPreview(server.url);
        browserNavigated = true;
    }, /\/api\/catalog\/movies: expected HTTP 200, received 404/);
    assert.equal(browserNavigated, false);
    assert.ok(server.requests.includes('/yify/movies'));
    assert.ok(server.requests.includes('/api/catalog/movies?page=1&limit=1&v=2'));
});

test('preflight accepts real metadata handler fixtures at the origin root beneath a Pages base path', async t => {
    const {checkWebPreview} = await checker;
    const {createCatalogHandler} = loadTypeScript('data/server/catalog/handler.ts');
    const date = new Date('2026-09-29T00:00:00.000Z');
    const movie = {id: 42, imdbCode: 'tt0000042', title: 'Preview movie', titleLong: 'Preview movie (2026)',
        year: 2026, rating: 8, runtimeMinutes: 90, genres: ['Drama'], summary: 'A preview fixture.',
        language: 'en', mpaRating: 'PG', posterUrls: [], backgroundImageUrl: '', ytTrailerCode: '', thumbnailUrls: []};
    const episode = {id: 12, title: 'Preview episode', season: 1, episode: 2, releasedAt: date,
        thumbnailUrl: '', seeds: 20, peers: 10, sizeBytes: 1000, magnetUrl: ''};
    const show = {imdbId: '1234567', imdbCode: 'tt1234567', title: 'Preview series', episodeCount: 1,
        latestEpisode: episode, thumbnailUrl: '', updatedAt: date};
    const handle = createCatalogHandler({
        movies: {listMovies: async () => ({movies: [movie], pageNumber: 1, movieCount: 1, hasMore: false})},
        shows: {listShows: async () => ({shows: [show], pageNumber: 1, hasMore: false})},
    });
    const server = await preview(t, handle);
    const result = await checkWebPreview(server.url);
    assert.equal(result.checks.length, 5);
    assert.deepEqual(result.checks.slice(-2).map(check => check.count), [1, 1]);
    const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'window');
    Object.defineProperty(globalThis, 'window', {configurable: true, value: {location: new URL(server.url)}});
    t.after(() => descriptor ? Object.defineProperty(globalThis, 'window', descriptor) : delete globalThis.window);
    const {WebCatalogClient} = loadTypeScript('data/datasources/WebCatalogClient.ts');
    const client = new WebCatalogClient();
    assert.equal((await client.listMovies({page: 1})).movies[0].title, movie.title);
    assert.equal((await client.listShows({page: 1})).shows[0].title, show.title);
    assert.ok(server.requests.filter(url => url.includes('api/')).every(url => url.startsWith('/api/catalog/')));
});

for (const [name, response, message] of [
    ['SPA HTML fallback', () => new Response('<html>app</html>', {headers: {'content-type': 'text/html'}}), /expected application\/json/],
    ['provider JSON shape', () => Response.json({data: {movies: []}}), /invalid movies catalog response shape/],
    ['malformed JSON', () => new Response('{', {headers: {'content-type': 'application/json'}}), /invalid catalog JSON/],
    ['cross-origin redirect', () => new Response(null, {status: 302, headers: {location: 'https://yify.expo.app/api/catalog/movies'}}), /preview request failed/],
]) {
    test(`preflight rejects ${name}`, async t => {
        const {checkWebPreview} = await checker;
        const server = await preview(t, response);
        await assert.rejects(checkWebPreview(server.url), message);
    });
}

test('a missing shows fixture cannot pass behind a valid movie fixture', async t => {
    const {checkWebPreview} = await checker;
    const server = await preview(t, (_, operation) => operation === 'movies'
        ? Response.json({movies: [], pageNumber: 1, movieCount: 0, hasMore: false})
        : new Response(null, {status: 404}));
    await assert.rejects(checkWebPreview(server.url), /\/api\/catalog\/shows: expected HTTP 200, received 404/);
});

test('the CLI rejects static-only previews with an actionable setup error', async t => {
    const server = await preview(t, () => new Response(null, {status: 404}));
    const child = spawn(process.execPath, ['scripts/check-web-preview.mjs', server.url], {
        cwd: require('node:path').resolve(__dirname, '..'), stdio: ['ignore', 'pipe', 'pipe'],
    });
    let output = '';
    child.stderr.on('data', chunk => { output += chunk; });
    const [status] = await once(child, 'close');
    assert.equal(status, 1);
    assert.match(output, /Serve a Hosting export with Expo serve or configure same-origin catalog fixtures/);
});

test('QA network policy allows only its same-origin server and explicit image origins', async () => {
    const {isPreviewRequestAllowed} = await checker;
    const base = 'http://127.0.0.1:58841/yify/';
    const images = ['https://image.tmdb.org'];
    for (const url of ['http://127.0.0.1:58841/api/catalog/movies', 'http://127.0.0.1:58841/yify/_expo/entry.js',
        'https://image.tmdb.org/t/p/w500/poster.jpg']) assert.equal(isPreviewRequestAllowed(url, base, images), true);
    for (const url of ['https://example.ingest.sentry.io/api/123/envelope/', 'https://www.google-analytics.com/g/collect',
        'https://googleads.g.doubleclick.net/pagead/ads', 'https://yify.expo.app/api/catalog/movies',
        'http://127.0.0.1:58842/api/catalog/movies', 'https://image.tmdb.org.attacker.invalid/poster.jpg',
        'https://private:secret@image.tmdb.org/poster.jpg', 'file:///tmp/report']) {
        assert.equal(isPreviewRequestAllowed(url, base, images), false);
    }
});
