import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {setImmediate as nextTurn} from 'node:timers/promises';
import {test} from 'node:test';

const require = createRequire(import.meta.url);
const {loadTypeScript} = require('../../../tests/helpers/load-typescript.cjs');
const {SubscriberAccessError} = loadTypeScript('data/server/subscribers/errors.ts');
const {createCatalogHandler} = loadTypeScript('data/server/catalog/handler.ts', {'../subscribers/errors': {SubscriberAccessError}});
const {createCatalogRepositories} = loadTypeScript('data/server/catalog/repositories.ts');
const HASH = '0123456789abcdef0123456789abcdef01234567';
const MAGNET = `magnet:?xt=urn:btih:${HASH}`;
const movie = {
    id: 10, imdb_code: 'tt1234567', title: 'A film', title_long: 'A film (2026)', year: 2026,
    rating: 8, runtime: 90, genres: ['Drama'], summary: 'A story', language: 'en', mpa_rating: 'PG',
    description_full: 'A story', synopsis: 'A story', yt_trailer_code: '',
    torrents: [{url: 'https://provider.invalid/movie.torrent', hash: HASH, quality: '1080p'}],
};
const episode = {
    id: 20, title: 'A series S01E02', imdb_id: '1234567', season: '1', episode: '2',
    magnet_url: MAGNET, seeds: 10, date_released_unix: 100,
};

function request(operation = 'movie', query = 'id=10', init: RequestInit = {}): Request {
    return new Request(`https://yify.expo.app/api/subscriber-catalog/${operation}?${query}`, init);
}

function privateHeaders(response: Response): void {
    assert.equal(response.headers.get('Cache-Control'), 'private, no-store');
    assert.equal(response.headers.get('CDN-Cache-Control'), 'no-store');
    assert.equal(response.headers.get('Vary'), 'Authorization');
    assert.equal(response.headers.get('Access-Control-Allow-Credentials'), null);
}

for (const [operation, query] of [
    ['movies', 'page=1&limit=20'], ['movie', 'id=10'], ['suggestions', 'id=10'],
    ['parental-guides', 'id=10'], ['shows', 'page=1'], ['episodes', 'imdbId=1234567'],
]) {
    test(`subscribers receive original ${operation} DTOs and projected metadata from the same fetches`, async () => {
        const calls: string[] = [];
        const original: unknown[] = [];
        let authorized = false;
        const handler = createCatalogHandler((signal: AbortSignal, onResponse: (body: unknown) => void) => {
            assert.equal(authorized, true);
            return createCatalogRepositories({}, {signal, onResponse, fetch: async (input: string) => {
                calls.push(input);
                const url = new URL(input);
                const body = operation === 'movie' ? {status: 'ok', data: {movie}}
                    : operation === 'parental-guides' ? {status: 'ok', data: {parental_guides: [{type: 'Violence', parental_guide_text: 'Mild.'}]}}
                    : ['shows', 'episodes'].includes(operation) ? {torrents: url.searchParams.get('page') === '1' ? [episode] : []}
                    : {status: 'ok', data: {movies: [movie], page_number: 1, movie_count: 1, limit: 20}};
                original.push(body);
                return Response.json(body);
            }});
        }, {subscriber: {authorize: async () => { authorized = true; return {uid: 'verified-account'}; }}});
        const response = await handler(request(operation, query), operation);
        assert.equal(response.status, 200);
        privateHeaders(response);
        const body = await response.json();
        assert.deepEqual(body.raw.responses, original);
        assert.equal(calls.length, operation === 'episodes' ? 2 : 1);
        assert.deepEqual(Object.keys(body).sort(), ['metadata', 'raw']);
        assert.ok(!JSON.stringify(body.metadata).includes(HASH));
        assert.ok(!JSON.stringify(body.metadata).includes('torrents'));
        assert.ok(!JSON.stringify(body.metadata).includes('magnet'));
    });
}

test('public catalog never enables raw capture even when an Authorization header is supplied', async () => {
    const handler = createCatalogHandler((signal: AbortSignal, capture: unknown) => {
        assert.equal(capture, undefined);
        return createCatalogRepositories({}, {signal, fetch: async () => Response.json({status: 'ok', data: {movie}})});
    });
    const response = await handler(request('movie', 'id=10', {headers: {Authorization: 'Bearer client-claim'}}), 'movie');
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.raw, undefined);
    assert.equal(body.torrents, undefined);
    assert.ok(!JSON.stringify(body).includes(HASH));
});

for (const status of [401, 403, 503]) {
    test(`subscriber authorization ${status} cannot initialize upstream repositories or leak error details`, async () => {
        let initialized = false;
        const handler = createCatalogHandler(() => { initialized = true; throw new Error('Unexpected'); }, {
            subscriber: {authorize: async () => {
                const error = new SubscriberAccessError(status);
                error.message = `private provider response ${MAGNET}`;
                throw error;
            }},
        });
        const response = await handler(request(), 'movie');
        assert.equal(response.status, status);
        assert.equal(initialized, false);
        privateHeaders(response);
        const body = await response.text();
        assert.ok(!body.includes('private provider'));
        assert.ok(!body.includes(HASH));
    });
}

test('private validation, preflight and admission happen before subscription/provider requests', async () => {
    let authorizations = 0;
    let acquisitions = 0;
    const handler = createCatalogHandler(() => { throw new Error('Not reached'); }, {
        subscriber: {authorize: async () => { authorizations++; return {uid: 'verified-account'}; }},
        admission: {acquire() { acquisitions++; return {allowed: false, retryAfter: 3}; }},
    });
    const invalid = await handler(request('movie', 'id=10&subscribed=true'), 'movie');
    assert.equal(invalid.status, 400);
    privateHeaders(invalid);
    const preflight = await handler(request('movie', 'id=10', {method: 'OPTIONS', headers: {
        Origin: 'https://kunal26das.github.io', 'Access-Control-Request-Method': 'GET',
        'Access-Control-Request-Headers': 'Authorization, Accept',
    }}), 'movie');
    assert.equal(preflight.status, 204);
    assert.equal(preflight.headers.get('Access-Control-Allow-Headers'), 'Accept, Content-Type, Authorization');
    privateHeaders(preflight);
    assert.equal(acquisitions, 0);
    const limited = await handler(request(), 'movie');
    assert.equal(limited.status, 429);
    privateHeaders(limited);
    assert.equal(limited.headers.get('Retry-After'), '3');
    assert.equal(authorizations, 0);
});

test('cancellation during authorization prevents provider access and holds capacity until work settles', async () => {
    const caller = new AbortController();
    let initialized = false;
    let released = 0;
    let authorizationSignal: AbortSignal | undefined;
    let resolve: (value: {uid: string}) => void = () => {};
    const handler = createCatalogHandler(() => { initialized = true; throw new Error('Not reached'); }, {
        subscriber: {authorize: (_request: Request, signal: AbortSignal) => {
            authorizationSignal = signal;
            return new Promise<{uid: string}>(complete => { resolve = complete; });
        }},
        admission: {acquire() { return {allowed: true, release() { released++; }}; }},
    });
    const pending = handler(request('movie', 'id=10', {signal: caller.signal}), 'movie');
    await nextTurn();
    caller.abort();
    const response = await pending;
    assert.equal(response.status, 504);
    privateHeaders(response);
    assert.equal(authorizationSignal?.aborted, true);
    assert.equal(released, 0);
    resolve({uid: 'verified-account'});
    await nextTurn();
    assert.equal(initialized, false);
    assert.equal(released, 1);
});

test('upstream errors after authorization remain private and expose none of the captured raw data', async () => {
    const handler = createCatalogHandler((signal: AbortSignal, onResponse: (body: unknown) => void) =>
        createCatalogRepositories({}, {signal, onResponse, fetch: async () => {
            throw new Error(MAGNET);
        }}), {subscriber: {authorize: async () => ({uid: 'verified-account'})}});
    const response = await handler(request(), 'movie');
    assert.equal(response.status, 502);
    privateHeaders(response);
    assert.deepEqual(await response.json(), {error: 'Catalog is temporarily unavailable'});
});
