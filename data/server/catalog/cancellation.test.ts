import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {setImmediate as nextTurn} from 'node:timers/promises';
import {test} from 'node:test';

const require = createRequire(import.meta.url);
const {loadTypeScript} = require('../../../tests/helpers/load-typescript.cjs');
const {createCatalogHandler} = loadTypeScript('data/server/catalog/handler.ts');
const {createCatalogRepositories} = loadTypeScript('data/server/catalog/repositories.ts');
const {createCatalogFetch} = loadTypeScript('data/server/catalog/cancellation.ts');

const movieResponse = () => Response.json({status: 'ok', data: {movie: {
    id: 10, imdb_code: 'tt1234567', title: 'A film', title_long: 'A film (2026)', year: 2026,
    rating: 8, runtime: 90, genres: ['Drama'], summary: 'A story', language: 'en', mpa_rating: 'PG',
    description_full: 'A story', synopsis: 'A story', yt_trailer_code: '', torrents: [],
}}});
const episodesResponse = () => Response.json({torrents: [{
    id: 20, title: 'A series S01E02', imdb_id: '1234567', season: '1', episode: '2',
    magnet_url: '', seeds: 10, date_released_unix: 100,
}]});

function request(operation = 'movie', signal?: AbortSignal): Request {
    const query = operation === 'episodes' ? 'imdbId=1234567' : 'id=10';
    return new Request(`https://yify.expo.app/api/catalog/${operation}?${query}`, {signal});
}

function admission() {
    const state = {acquired: 0, released: 0};
    return {state, port: {acquire() {
        state.acquired++;
        return {allowed: true, release() { state.released++; }};
    }}};
}

test('deadline aborts the actual upstream fetch and releases capacity after rejection settles', async () => {
    const lease = admission();
    let signal: AbortSignal | undefined;
    const handler = createCatalogHandler((requestSignal: AbortSignal) => createCatalogRepositories({}, {
        signal: requestSignal,
        fetch: (_input: unknown, init: RequestInit) => new Promise((_, reject) => {
            signal = init.signal!;
            signal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')), {once: true});
        }),
    }), {timeoutMs: 5, admission: lease.port});
    const response = await handler(request(), 'movie');
    assert.equal(response.status, 504);
    assert.equal(signal?.aborted, true);
    assert.deepEqual(await response.json(), {error: 'Catalog request timed out'});
    await nextTurn();
    assert.deepEqual(lease.state, {acquired: 1, released: 1});
});

test('caller cancellation stops episode pagination and holds capacity until an abort-ignoring fetch actually settles', async () => {
    const caller = new AbortController();
    const lease = admission();
    let calls = 0;
    let secondSignal: AbortSignal | undefined;
    let resolveSecond: (value: Response) => void = () => {};
    let secondStarted: () => void = () => {};
    const started = new Promise<void>(resolve => { secondStarted = resolve; });
    const handler = createCatalogHandler((signal: AbortSignal) => createCatalogRepositories({}, {
        signal,
        fetch: (_input: unknown, init: RequestInit) => {
            calls++;
            if (calls === 1) return Promise.resolve(episodesResponse());
            secondSignal = init.signal!;
            secondStarted();
            return new Promise<Response>(resolve => { resolveSecond = resolve; });
        },
    }), {timeoutMs: 1000, admission: lease.port});
    const result = handler(request('episodes', caller.signal), 'episodes');
    await started;
    caller.abort();
    assert.equal((await result).status, 504);
    assert.equal(secondSignal?.aborted, true);
    assert.equal(calls, 2);
    assert.deepEqual(lease.state, {acquired: 1, released: 0});
    resolveSecond(episodesResponse());
    await nextTurn();
    assert.equal(calls, 2);
    assert.deepEqual(lease.state, {acquired: 1, released: 1});
});

test('request cancellation stays connected while the upstream response body is being read', async () => {
    let bodyAborted = false;
    const handler = createCatalogHandler((signal: AbortSignal) => createCatalogRepositories({}, {
        signal,
        fetch: async (_input: unknown, init: RequestInit) => new Response(new ReadableStream({
            start(stream) {
                init.signal!.addEventListener('abort', () => {
                    bodyAborted = true;
                    stream.error(new DOMException('Aborted', 'AbortError'));
                }, {once: true});
            },
        })),
    }), {timeoutMs: 5});
    assert.equal((await handler(request(), 'movie')).status, 504);
    await nextTurn();
    assert.equal(bodyAborted, true);
});

test('simultaneous server requests do not share another caller’s cancellable YTS promise', async () => {
    const caller = new AbortController();
    const pending: {signal: AbortSignal; resolve: (value: Response) => void}[] = [];
    const handler = createCatalogHandler((signal: AbortSignal) => createCatalogRepositories({}, {
        signal,
        fetch: (_input: unknown, init: RequestInit) => new Promise<Response>((resolve, reject) => {
            pending.push({signal: init.signal!, resolve});
            init.signal!.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')), {once: true});
        }),
    }), {timeoutMs: 1000});
    const first = handler(request('movie', caller.signal), 'movie');
    const second = handler(request(), 'movie');
    await nextTurn();
    assert.equal(pending.length, 2);
    caller.abort();
    assert.equal((await first).status, 504);
    assert.equal(pending[0].signal.aborted, true);
    assert.equal(pending[1].signal.aborted, false);
    pending[1].resolve(movieResponse());
    const response = await second;
    assert.equal(response.status, 200);
    assert.equal((await response.json()).title, 'A film');
});

test('server fetch preserves each existing fetch timeout as well as the overall deadline', async () => {
    const overall = new AbortController();
    const localTimeout = new AbortController();
    let combined: AbortSignal | undefined;
    const fetcher = createCatalogFetch(overall.signal, async (_input: unknown, init: RequestInit) => {
        combined = init.signal!;
        return Response.json({});
    });
    await fetcher('https://example.com', {signal: localTimeout.signal});
    assert.equal(combined?.aborted, false);
    localTimeout.abort();
    assert.equal(combined?.aborted, true);
    assert.equal(overall.signal.aborted, false);
});

test('already cancelled requests avoid repository construction and release the acquired lease', async () => {
    const caller = new AbortController();
    caller.abort();
    const lease = admission();
    let initialized = false;
    const handler = createCatalogHandler(() => { initialized = true; throw new Error('Not reached'); }, {admission: lease.port});
    assert.equal((await handler(request('movie', caller.signal), 'movie')).status, 504);
    assert.equal(initialized, false);
    assert.deepEqual(lease.state, {acquired: 1, released: 1});
});

test('synchronous repository factory failures release capacity and keep errors generic', async () => {
    const lease = admission();
    const handler = createCatalogHandler(() => { throw new Error('private upstream configuration'); }, {admission: lease.port});
    const response = await handler(request(), 'movie');
    assert.equal(response.status, 502);
    assert.deepEqual(await response.json(), {error: 'Catalog is temporarily unavailable'});
    assert.deepEqual(lease.state, {acquired: 1, released: 1});
});

test('validation and OPTIONS happen before admission, and denied requests never initialize upstream repositories', async () => {
    let acquired = 0;
    let initialized = false;
    const handler = createCatalogHandler(() => { initialized = true; throw new Error('Not reached'); }, {
        admission: {acquire() { acquired++; return {allowed: false, retryAfter: 7}; }},
    });
    assert.equal((await handler(new Request('https://yify.expo.app/api/catalog/movie?id=0'), 'movie')).status, 400);
    assert.equal((await handler(new Request(request().url, {method: 'OPTIONS'}), 'movie')).status, 204);
    assert.equal(acquired, 0);
    const response = await handler(request(), 'movie');
    assert.equal(response.status, 429);
    assert.equal(response.headers.get('Retry-After'), '7');
    assert.equal(response.headers.get('Cache-Control'), 'no-store');
    assert.equal(response.headers.get('Access-Control-Allow-Origin'), '*');
    assert.deepEqual(await response.json(), {error: 'Too many catalog requests. Please try again shortly.'});
    assert.equal(initialized, false);
    assert.equal(acquired, 1);
});

test('successful work releases capacity once and detaches later caller cancellation', async () => {
    const caller = new AbortController();
    const lease = admission();
    let signal: AbortSignal | undefined;
    const handler = createCatalogHandler((requestSignal: AbortSignal) => {
        signal = requestSignal;
        return createCatalogRepositories({}, {signal, fetch: async () => movieResponse()});
    }, {admission: lease.port});
    assert.equal((await handler(request('movie', caller.signal), 'movie')).status, 200);
    assert.deepEqual(lease.state, {acquired: 1, released: 1});
    caller.abort();
    assert.equal(signal?.aborted, false);
    assert.equal(lease.state.released, 1);
});
