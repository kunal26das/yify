import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {test} from 'node:test';

const require = createRequire(import.meta.url);
const {loadTypeScript} = require('../../../tests/helpers/load-typescript.cjs');
const {createCatalogHandler} = loadTypeScript('data/server/catalog/handler.ts');
const {safeImageUrl} = loadTypeScript('data/server/catalog/projections.ts');
const ORIGIN = 'https://yify.expo.app';
const HASH = '0123456789abcdef0123456789abcdef01234567';
const MAGNET = `magnet:?xt=urn:btih:${HASH}`;
const DOWNLOAD = 'https://provider.invalid/download/movie.torrent';
const IMAGE = 'https://images.example.com/poster.jpg';
const DATE = new Date('2026-09-11T04:00:00.000Z');
const movie = {
    id: 10, imdbCode: 'tt1234567', title: 'A film', titleLong: 'A film (2026)', year: 2026,
    rating: 8.2, runtimeMinutes: 110, genres: ['Drama'], summary: 'A safe synopsis.', language: 'en',
    mpaRating: 'PG', posterUrls: [IMAGE], backgroundImageUrl: IMAGE, ytTrailerCode: 'Abcdef123_-', thumbnailUrls: [IMAGE],
    descriptionIntro: 'Introduction', descriptionFull: 'Full description', synopsis: 'Synopsis', likeCount: 3,
    downloadCount: 123, screenshotUrls: [IMAGE], screenshotThumbUrls: [IMAGE],
    cast: [{name: 'Actor', character: 'Hero', imdbCode: 'nm1234567', imageUrl: IMAGE, hash: HASH, url: DOWNLOAD}],
    torrents: [{url: DOWNLOAD, hash: HASH, magnetUrl: MAGNET}], url: DOWNLOAD, unknown: {hash: HASH},
};
const episode = {
    id: 20, title: 'A series S01E02', season: 1, episode: 2, releasedAt: DATE, thumbnailUrl: IMAGE,
    magnetUrl: MAGNET, seeds: 100, peers: 20, sizeBytes: 12345, url: DOWNLOAD, unknown: {hash: HASH},
};
const show = {
    imdbId: '1234567', imdbCode: 'tt1234567', title: 'A series', episodeCount: 3,
    latestEpisode: episode, thumbnailUrl: IMAGE, updatedAt: DATE, url: DOWNLOAD, torrents: [episode],
};

function fixtures(overrides: Record<string, unknown> = {}) {
    const calls: unknown[] = [];
    const repositories = {
        movies: {
            async listMovies(params: unknown) { calls.push(['movies', params]); return {movies: [movie], pageNumber: 1, movieCount: 2, hasMore: true, torrents: [episode]}; },
            async getMovieDetails(id: number) { calls.push(['movie', id]); return movie; },
            async getMovieSuggestions(id: number) { calls.push(['suggestions', id]); return [movie]; },
            async getMovieParentalGuides(id: number) { calls.push(['parental-guides', id]); return [{type: 'Violence', text: 'Mild.', url: DOWNLOAD}]; },
            ...overrides,
        },
        shows: {
            async listShows(params: unknown) { calls.push(['shows', params]); return {shows: [show], pageNumber: 1, hasMore: false, magnet: MAGNET}; },
            async listEpisodes(imdbId: string) { calls.push(['episodes', imdbId]); return [episode]; },
        },
    };
    return {calls, repositories, handler: createCatalogHandler(repositories)};
}

function request(operation: string, query = '', origin: string | null = ORIGIN, method = 'GET', extraHeaders = {}) {
    return new Request(`${ORIGIN}/api/catalog/${operation}${query ? `?${query}` : ''}`, {
        method, headers: {...(origin === null ? {} : {Origin: origin}), ...extraHeaders},
    });
}

function assertNoRestrictedFields(value: unknown) {
    if (!value || typeof value !== 'object') return;
    for (const [key, child] of Object.entries(value)) {
        assert.ok(!['torrents', 'torrent', 'downloadCount', 'magnetUrl', 'magnet', 'hash', 'seeds', 'peers', 'sizeBytes', 'url', 'unknown'].includes(key), key);
        assertNoRestrictedFields(child);
    }
    const serialized = JSON.stringify(value);
    assert.ok(!serialized.includes(HASH));
    assert.ok(!serialized.includes(DOWNLOAD));
    assert.ok(!serialized.includes(MAGNET));
}

for (const [operation, query] of [
    ['movies', 'page=1&limit=20'], ['movie', 'id=10'], ['suggestions', 'id=10'],
    ['parental-guides', 'id=10'], ['shows', 'page=1'], ['episodes', 'imdbId=tt1234567'],
]) {
    test(`${operation} returns only projected metadata without an envelope`, async () => {
        const {handler, calls} = fixtures();
        const response = await handler(request(operation, query), operation);
        assert.equal(response.status, 200);
        assert.equal(response.headers.get('Access-Control-Allow-Origin'), '*');
        assert.equal(response.headers.get('Vary'), null);
        assert.equal(response.headers.get('X-Content-Type-Options'), 'nosniff');
        assert.equal(response.headers.get('Cache-Control'), 'public, max-age=60, s-maxage=300');
        const body = await response.json();
        assertNoRestrictedFields(body);
        assert.equal(calls.length, 1);
        if (operation === 'movies') {
            assert.deepEqual(Object.keys(body).sort(), ['hasMore', 'movieCount', 'movies', 'pageNumber']);
            assert.equal(body.movies[0].title, movie.title);
            assert.equal(body.movies[0].summary, movie.summary);
        } else if (operation === 'movie') {
            assert.equal(body.id, 10);
            assert.equal(body.cast[0].character, 'Hero');
            assert.equal(body.ytTrailerCode, 'Abcdef123_-');
            assert.equal(body.descriptionFull, 'Full description');
            assert.deepEqual(body.screenshotUrls, [IMAGE]);
        } else if (operation === 'shows') {
            assert.deepEqual(Object.keys(body).sort(), ['hasMore', 'pageNumber', 'shows']);
            assert.equal(body.shows[0].updatedAt, DATE.toISOString());
            assert.equal(body.shows[0].latestEpisode.releasedAt, DATE.toISOString());
        } else {
            assert.ok(Array.isArray(body));
            if (operation === 'episodes') {
                assert.equal(body[0].releasedAt, DATE.toISOString());
                assert.deepEqual(calls[0], ['episodes', '1234567']);
            }
            if (operation === 'parental-guides') assert.deepEqual(body, [{type: 'Violence', text: 'Mild.'}]);
        }
    });
}

test('embedded URLs and hashes are removed from every free text field and unsafe images disappear', async () => {
    const malicious = `Safe ${MAGNET} ${encodeURIComponent(DOWNLOAD)} ${HASH} end`;
    const {handler} = fixtures({
        async getMovieDetails() {
            return {...movie, title: malicious, titleLong: malicious, summary: malicious, language: malicious,
                mpaRating: malicious, genres: [malicious], descriptionIntro: malicious, descriptionFull: malicious,
                synopsis: malicious, imdbCode: malicious, ytTrailerCode: malicious,
                posterUrls: [MAGNET, DOWNLOAD, `https://wsrv.nl/?url=${encodeURIComponent(MAGNET)}&w=480`, IMAGE],
                screenshotUrls: [DOWNLOAD], screenshotThumbUrls: [DOWNLOAD], backgroundImageUrl: DOWNLOAD,
                thumbnailUrls: [DOWNLOAD], cast: [{name: malicious, character: malicious, imdbCode: malicious, imageUrl: DOWNLOAD}]};
        },
    });
    const response = await handler(request('movie', 'id=10'), 'movie');
    const body = await response.json();
    assert.equal(response.status, 200);
    assertNoRestrictedFields(body);
    assert.equal(body.title, 'Safe end');
    assert.equal(body.cast[0].character, 'Safe end');
    assert.equal(body.imdbCode, '');
    assert.equal(body.ytTrailerCode, '');
    assert.deepEqual(body.posterUrls, [IMAGE]);
    assert.deepEqual(body.screenshotUrls, []);
    assert.equal(body.backgroundImageUrl, undefined);
});

test('parental guide and episode strings cannot carry encoded download instructions', async () => {
    const {handler, repositories} = fixtures({async getMovieParentalGuides() {
        return [{type: '<a href="https://provider.invalid">Violence</a>', text: `Note magnet&#58;?xt=urn:btih:${HASH} ${encodeURIComponent(encodeURIComponent(DOWNLOAD))}`}];
    }});
    repositories.shows.listEpisodes = async () => [{...episode, title: `Episode ${MAGNET} ${HASH}`, thumbnailUrl: DOWNLOAD}];
    const guides = await (await handler(request('parental-guides', 'id=10'), 'parental-guides')).json();
    const episodes = await (await handler(request('episodes', 'imdbId=1234567'), 'episodes')).json();
    assert.deepEqual(guides, [{type: 'Violence', text: 'Note'}]);
    assert.equal(episodes[0].title, 'Episode');
    assert.equal(episodes[0].thumbnailUrl, undefined);
    assertNoRestrictedFields(episodes);
});

test('excessively encoded upstream text fails closed instead of forwarding an encoded payload', async () => {
    let encoded = MAGNET;
    for (let i = 0; i < 8; i++) encoded = encodeURIComponent(encoded);
    const {handler} = fixtures({async getMovieDetails() { return {...movie, summary: encoded}; }});
    const response = await handler(request('movie', 'id=10'), 'movie');
    assert.equal(response.status, 200);
    assert.equal((await response.json()).summary, '');
});

test('image validation checks the nested proxy source and accepts normal HTTPS artwork', () => {
    const proxied = `https://wsrv.nl/?url=${encodeURIComponent(IMAGE)}&w=480&fit=cover&output=webp&q=80&we`;
    assert.equal(safeImageUrl(IMAGE), IMAGE);
    assert.equal(safeImageUrl(proxied), `${proxied}=`);
    for (const value of [
        'http://images.example.com/poster.jpg', '//images.example.com/poster.jpg', 'javascript:alert(1)',
        'data:image/png;base64,secret', MAGNET, DOWNLOAD, 'https://user:password@images.example.com/poster.jpg',
        'https://127.0.0.1/private.jpg', 'https://localhost/private.jpg', 'https://host.internal/private.jpg',
        'https://images.example.com/download/poster.jpg', `https://images.example.com/${HASH}.jpg`,
        `https://images.example.com/poster.jpg?hash=${HASH}`, 'https://images.example.com/poster.jpg#secret',
        `https://wsrv.nl/?url=${encodeURIComponent(MAGNET)}&w=480`,
        `https://wsrv.nl/?url=${encodeURIComponent(DOWNLOAD)}&w=480`,
        `https://wsrv.nl/?url=${encodeURIComponent(IMAGE)}&url=${encodeURIComponent(DOWNLOAD)}`,
        `https://wsrv.nl/?url=${encodeURIComponent(IMAGE)}&secret=provider-data`,
        `https://wsrv.nl/?url=${encodeURIComponent(proxied)}`,
        `https://wsrv.nl/?url=${encodeURIComponent(IMAGE)}&w=99999`,
    ]) assert.equal(safeImageUrl(value), undefined, value);
});

test('valid movie filters are bounded, normalized and forwarded without private fields', async () => {
    const {handler, calls} = fixtures();
    const response = await handler(request('movies', 'page=2&limit=50&query=%20A%20film%20&quality=1080p.x265&minimum_rating=7.5&genre=drama&sort_by=rating&order_by=desc'), 'movies');
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('Cache-Control'), 'no-store');
    assert.deepEqual(calls, [['movies', {page: 2, limit: 50, query: 'A film', quality: '1080p.x265', minimum_rating: 7.5, genre: 'drama', sort_by: 'rating', order_by: 'desc'}]]);
});

test('show IMDb filters accept and normalize the tt prefix', async () => {
    const {handler, calls} = fixtures();
    const response = await handler(request('shows', 'page=3&limit=40&imdbId=tt0012345'), 'shows');
    assert.equal(response.status, 200);
    assert.deepEqual(calls, [['shows', {page: 3, limit: 40, imdbId: '0012345'}]]);
});

test('invalid, extra and duplicate parameters never reach repositories', async () => {
    const {handler, calls} = fixtures();
    for (const [operation, query] of [
        ['movies', 'page=0'], ['movies', 'page=-1'], ['movies', 'page=1.5'], ['movies', 'page=1e2'],
        ['movies', 'page=10001'], ['movies', 'limit=0'], ['movies', 'limit=51'], ['movies', 'page=1&page=2'],
        ['movies', 'quality=4k'], ['movies', 'genre=private'], ['movies', 'sort_by=url'], ['movies', 'order_by=random'],
        ['movies', 'minimum_rating=10.1'], ['movies', 'minimum_rating=NaN'], ['movies', 'query=%00bad'],
        ['movies', `query=${'x'.repeat(201)}`], ['movies', 'url=https://evil.invalid'],
        ['movie', ''], ['movie', 'id=0'], ['movie', 'id=2147483648'], ['movie', 'id=10&id=11'],
        ['movie', 'id=10&with_torrents=true'], ['suggestions', 'id=10&provider=evil'],
        ['parental-guides', 'id=10&url=evil'], ['shows', 'page=1&imdbId=tt'], ['shows', 'limit=51'],
        ['episodes', 'imdbId=tt0000000'], ['episodes', 'imdbId=https://evil.invalid'],
        ['episodes', 'imdbId=1234567&imdbId=7654321'], ['episodes', 'imdbId=1234567&limit=50'],
        ['unknown', ''], ['movies', `query=${'x'.repeat(2050)}`],
    ]) {
        const response = await handler(request(operation, query), operation);
        assert.equal(response.status, 400, `${operation}?${query}`);
        assert.equal(response.headers.get('Cache-Control'), 'no-store');
        assert.deepEqual(await response.json(), {error: 'Invalid catalog request'});
    }
    assert.deepEqual(calls, []);
});

test('public metadata CORS is independent of browser or Hosting-rewritten origins and never enables credentials', async () => {
    const {handler} = fixtures();
    for (const origin of [ORIGIN, 'https://kunal26das.github.io', 'https://yify--catalog-preview.expo.app', 'http://localhost:8081', 'http://127.0.0.1:54321', 'http://[::1]:8081', 'https://unknown-origin.invalid', 'null', null]) {
        const response = await handler(request('movies', '', origin), 'movies');
        assert.equal(response.status, 200, origin);
        assert.equal(response.headers.get('Access-Control-Allow-Origin'), '*');
        assert.equal(response.headers.get('Access-Control-Allow-Credentials'), null);
        assert.equal(response.headers.get('Vary'), null);
        const body = await response.json();
        assert.equal(body.movies[0].title, movie.title);
        assertNoRestrictedFields(body);
    }
});

test('OPTIONS validates CORS without upstream access and other methods are rejected', async () => {
    const {handler, calls} = fixtures();
    const response = await handler(request('movie', 'id=10', ORIGIN, 'OPTIONS', {'Access-Control-Request-Method': 'GET', 'Access-Control-Request-Headers': 'Accept, Content-Type'}), 'movie');
    assert.equal(response.status, 204);
    assert.equal(await response.text(), '');
    assert.equal(response.headers.get('Access-Control-Allow-Methods'), 'GET, OPTIONS');
    assert.equal(response.headers.get('Access-Control-Allow-Origin'), '*');
    assert.equal(response.headers.get('Access-Control-Allow-Credentials'), null);
    assert.equal(response.headers.get('Vary'), null);
    for (const method of ['POST', 'PUT', 'PATCH', 'DELETE', 'HEAD']) {
        const denied = await handler(request('movies', '', ORIGIN, method), 'movies');
        assert.equal(denied.status, 405);
        assert.equal(denied.headers.get('Allow'), 'GET, OPTIONS');
    }
    assert.equal((await handler(request('movies', '', ORIGIN, 'OPTIONS', {'Access-Control-Request-Method': 'POST'}), 'movies')).status, 405);
    assert.equal((await handler(request('movies', '', ORIGIN, 'OPTIONS', {'Access-Control-Request-Headers': 'Authorization'}), 'movies')).status, 400);
    assert.deepEqual(calls, []);
});

test('upstream failures expose no provider details or messages', async () => {
    for (const error of [new Error(`${DOWNLOAD} ${MAGNET}`), {url: DOWNLOAD, hash: HASH}, new TypeError(`secret ${HASH}`)]) {
        const {handler} = fixtures({async getMovieDetails() { throw error; }});
        const response = await handler(request('movie', 'id=10'), 'movie');
        assert.equal(response.status, 502);
        assert.equal(response.headers.get('Cache-Control'), 'no-store');
        assert.equal(response.headers.get('Access-Control-Allow-Origin'), '*');
        assert.deepEqual(await response.json(), {error: 'Catalog is temporarily unavailable'});
    }
});

test('timeouts return a generic 504 and do not return late provider results', async () => {
    const {repositories} = fixtures();
    let resolve: (value: unknown) => void = () => {};
    repositories.movies.getMovieDetails = () => new Promise(complete => { resolve = complete; });
    const handler = createCatalogHandler(repositories, {timeoutMs: 5});
    const response = await handler(request('movie', 'id=10'), 'movie');
    assert.equal(response.status, 504);
    assert.deepEqual(await response.json(), {error: 'Catalog request timed out'});
    resolve(movie);
    const aborted = fixtures({async getMovieDetails() { throw new DOMException(DOWNLOAD, 'AbortError'); }});
    assert.equal((await aborted.handler(request('movie', 'id=10'), 'movie')).status, 504);
});

test('malformed nested metadata fails closed and repository initialization errors remain generic', async () => {
    const {handler} = fixtures({async getMovieDetails() { return {...movie, cast: [null]}; }});
    const response = await handler(request('movie', 'id=10'), 'movie');
    assert.equal(response.status, 502);
    assert.deepEqual(await response.json(), {error: 'Catalog is temporarily unavailable'});
    let initialized = false;
    const lazy = createCatalogHandler(() => { initialized = true; throw new Error(DOWNLOAD); });
    assert.equal((await lazy(request('movie'), 'movie')).status, 400);
    assert.equal(initialized, false);
    assert.equal((await lazy(request('movie', 'id=10'), 'movie')).status, 502);
});

test('server repository URLs are fixed HTTPS upstreams and reject request-like overrides', () => {
    const {createCatalogRepositories} = loadTypeScript('data/server/catalog/repositories.ts');
    assert.doesNotThrow(() => createCatalogRepositories({}));
    assert.doesNotThrow(() => createCatalogRepositories({YIFY_CATALOG_YTS_BASE_URL: 'https://movies-api.accel.li/api/v2/'}));
    for (const value of ['http://movies-api.accel.li/api/v2', 'https://evil.invalid/api/v2', 'https://127.0.0.1/api/v2', 'https://user:secret@movies-api.accel.li/api/v2', 'https://movies-api.accel.li/api/v2?url=secret', 'https://movies-api.accel.li/other']) {
        assert.throws(() => createCatalogRepositories({YIFY_CATALOG_YTS_BASE_URL: value}));
    }
    assert.throws(() => createCatalogRepositories({YIFY_CATALOG_EZTV_BASE_URL: 'https://eztvx.to.evil.invalid/api'}));
});

test('real server repositories consume upstream torrent data but the public endpoint does not expose it', async t => {
    const {createCatalogRepositories} = loadTypeScript('data/server/catalog/repositories.ts');
    const urls: string[] = [];
    t.mock.method(globalThis, 'fetch', async (input: string) => {
        urls.push(input);
        if (input.startsWith('https://movies-api.accel.li/api/v2/movie_details.json?')) {
            return Response.json({status: 'ok', data: {movie: {
                id: 10, imdb_code: 'tt1234567', title: 'A film', title_long: 'A film (2026)', year: 2026,
                rating: 8, runtime: 90, genres: ['Drama'], summary: 'A story', language: 'en', mpa_rating: 'PG',
                large_cover_image: IMAGE, background_image: IMAGE, description_full: 'Story', synopsis: 'Story',
                yt_trailer_code: 'Abcdef123_-', torrents: [{url: DOWNLOAD, hash: HASH, seeds: 10, date_uploaded_unix: 1}],
                cast: [{name: 'Actor', character_name: 'Hero', url_small_image: IMAGE}], download_count: 100,
            }}});
        }
        return Response.json({page: 1, torrents: [{
            id: 20, title: 'A series S01E02', imdb_id: '1234567', season: '1', episode: '2',
            magnet_url: MAGNET, seeds: 10, peers: 2, size_bytes: '100', date_released_unix: 100,
            large_screenshot: IMAGE, torrent_url: DOWNLOAD, hash: HASH,
        }]});
    });
    const handler = createCatalogHandler(createCatalogRepositories({}));
    const detail = await (await handler(request('movie', 'id=10'), 'movie')).json();
    const shows = await (await handler(request('shows'), 'shows')).json();
    assert.equal(detail.title, 'A film');
    assert.equal(shows.shows[0].title, 'A series');
    assertNoRestrictedFields(detail);
    assertNoRestrictedFields(shows);
    assert.equal(urls.length, 2);
    assert.ok(urls.every(url => url.startsWith('https://movies-api.accel.li/api/v2/') || url.startsWith('https://eztvx.to/api/')));
});
