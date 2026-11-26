import assert from 'node:assert/strict';
import {afterEach, beforeEach, test} from 'node:test';
import type {ApiObservation} from './client';
import {apiGet, apiPost, apiQueryString, apiRoute, MAX_RETRY_AFTER_MS, parseRetryAfter, setApiObserver, stableJson} from './client';
import {ApiDecodeError, ApiError, NetworkError, TimeoutError} from './errors';
import {apiHealth} from './health';

interface Call {
  url: string;
  init: RequestInit;
}

const originalFetch = globalThis.fetch;
let calls: Call[] = [];
let observed: ApiObservation[] = [];

function respond(handler: (url: string, init: RequestInit) => Promise<Response> | Response): void {
  globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
    const url = String(input);
    calls.push({url, init: init ?? {}});
    return handler(url, init ?? {});
  }) as typeof fetch;
}

function hang(): void {
  respond((_url, init) => new Promise<Response>((_, reject) => {
    init.signal?.addEventListener('abort', () => reject(new DOMException('The operation was aborted.', 'AbortError')));
  }));
}

const identity = (body: unknown) => body;

beforeEach(() => {
  calls = [];
  observed = [];
  apiHealth.reset();
  setApiObserver((result) => observed.push(result));
});

afterEach(() => {
  globalThis.fetch = originalFetch;
  setApiObserver(null);
});

test('GET sorts the query, drops empty values and sends the client header without credentials', async () => {
  respond(() => Response.json({v: 2, ok: true}));
  const body = await apiGet('/search', {type: 'all', q: 'the matrix', page: 1, genres: '28,12', empty: '', skipped: undefined}, identity);
  assert.deepEqual(body, {v: 2, ok: true});
  assert.equal(calls[0].url, 'https://yify.expo.app/api/v2/search?genres=28,12&page=1&q=the%20matrix&type=all');
  assert.equal(calls[0].init.method, 'GET');
  assert.equal(calls[0].init.credentials, 'omit');
  assert.equal(calls[0].init.redirect, 'error');
  assert.deepEqual(calls[0].init.headers, {'Accept': 'application/json', 'X-Yify-Client': 'android/2.0.0'});
  assert.deepEqual(observed.map(({route, status}) => [route, status]), [['search', 200]]);
});

test('POST serialises the body with sorted keys', async () => {
  respond(() => Response.json({v: 2}));
  await apiPost('/availability', {region: 'IN', keys: ['movie:603', 'tv:1399'], a: {z: 1, b: 2}}, identity);
  assert.equal(calls[0].init.method, 'POST');
  assert.equal(calls[0].init.body, '{"a":{"b":2,"z":1},"keys":["movie:603","tv:1399"],"region":"IN"}');
  assert.equal((calls[0].init.headers as Record<string, string>)['Content-Type'], 'application/json');
  assert.equal(stableJson({b: [{d: 1, c: 2}], a: null}), '{"a":null,"b":[{"c":2,"d":1}]}');
});

test('error responses become ApiError with the envelope code and a capped Retry-After', async () => {
  respond(() => Response.json({error: {code: 'upstream_rate_limited', message: 'slow down'}}, {status: 503, headers: {'Retry-After': '12'}}));
  await assert.rejects(apiGet('/home', {region: 'IN'}, identity), (error: unknown) => {
    assert.ok(error instanceof ApiError);
    assert.deepEqual([error.status, error.code, error.retryAfterMs], [503, 'upstream_rate_limited', 12_000]);
    return true;
  });
  respond(() => Response.json({error: {code: 'rate_limited', message: 'x', retryAfterSeconds: 900}}, {status: 429}));
  await assert.rejects(apiGet('/home', {region: 'IN'}, identity), (error: unknown) => error instanceof ApiError && error.retryAfterMs === MAX_RETRY_AFTER_MS);
  respond(() => new Response('<html>oops</html>', {status: 502}));
  await assert.rejects(apiGet('/home', {region: 'IN'}, identity), (error: unknown) => error instanceof ApiError && error.code === 'internal' && error.retryAfterMs === null);
  respond(() => Response.json({error: {code: 'made_up'}}, {status: 400}));
  await assert.rejects(apiGet('/home', {region: 'IN'}, identity), (error: unknown) => error instanceof ApiError && error.code === 'internal' && error.status === 400);
  assert.deepEqual(observed.map(({status}) => status), [503, 429, 502, 400]);
});

test('Retry-After accepts seconds or an HTTP date and falls back to the envelope', () => {
  assert.equal(parseRetryAfter('30', undefined), 30_000);
  assert.equal(parseRetryAfter(new Date(10_000).toUTCString(), undefined, 0), 10_000);
  assert.equal(parseRetryAfter(null, 5), 5_000);
  assert.equal(parseRetryAfter('soon', undefined), null);
  assert.equal(parseRetryAfter(null, undefined), null);
});

test('transport failures become NetworkError and never trip the breaker', async () => {
  respond(() => {
    throw new TypeError('Network request failed');
  });
  for (let index = 0; index < 4; index += 1) await assert.rejects(apiGet('/home', {region: 'IN'}, identity), NetworkError);
  assert.equal(apiHealth.degraded(), false);
  assert.deepEqual(observed.map(({status}) => status), ['network', 'network', 'network', 'network']);
});

test('unknown fetch errors pass through unchanged', async () => {
  const strange = new TypeError('Cannot read properties of undefined');
  respond(() => {
    throw strange;
  });
  await assert.rejects(apiGet('/home', {region: 'IN'}, identity), (error: unknown) => error === strange);
  assert.deepEqual(observed, []);
});

test('the local timer turns a hanging request into TimeoutError', async () => {
  hang();
  await assert.rejects(apiGet('/home', {region: 'IN'}, identity, {timeoutMs: 10}), TimeoutError);
  assert.deepEqual(observed.map(({status}) => status), ['timeout']);
});

test('a caller abort surfaces the original AbortError and is not reported', async () => {
  hang();
  const controller = new AbortController();
  const request = apiGet('/home', {region: 'IN'}, identity, {signal: controller.signal, timeoutMs: 1000});
  controller.abort();
  await assert.rejects(request, (error: unknown) => error instanceof Error && error.name === 'AbortError');
  const aborted = new AbortController();
  aborted.abort();
  await assert.rejects(apiGet('/home', {region: 'IN'}, identity, {signal: aborted.signal}), (error: unknown) => error instanceof Error && error.name === 'AbortError');
  assert.equal(calls.length, 1);
  assert.deepEqual(observed, []);
});

test('bodies that are not JSON or do not decode become ApiDecodeError', async () => {
  respond(() => new Response('not json', {status: 200}));
  await assert.rejects(apiGet('/genres', {}, identity), (error: unknown) => error instanceof ApiDecodeError && error.route === 'genres');
  respond(() => Response.json({v: 1}));
  await assert.rejects(apiGet('/genres', {}, () => {
    throw new ApiDecodeError('genres');
  }), ApiDecodeError);
  respond(() => Response.json({v: 2}));
  await assert.rejects(apiGet('/genres', {}, () => {
    throw new RangeError('boom');
  }), (error: unknown) => error instanceof ApiDecodeError && error.route === 'genres');
  assert.deepEqual(observed.map(({status}) => status), ['decode', 'decode', 'decode']);
});

test('server errors feed the breaker and any response clears it', async () => {
  respond(() => Response.json({error: {code: 'internal', message: 'x'}}, {status: 500}));
  for (let index = 0; index < 3; index += 1) await assert.rejects(apiGet('/home', {region: 'IN'}, identity), ApiError);
  assert.equal(apiHealth.degraded(), true);
  respond(() => Response.json({error: {code: 'not_found', message: 'x'}}, {status: 404}));
  await assert.rejects(apiGet('/title/movie/1', {region: 'IN'}, identity), ApiError);
  assert.equal(apiHealth.degraded(), false);
});

test('routes are derived from the path', () => {
  assert.equal(apiRoute('/home?region=IN'), 'home');
  assert.equal(apiRoute('/title/movie/603'), 'title');
  assert.equal(apiRoute('/title/tv/1399/season/1'), 'season');
  assert.equal(apiRoute('/legacy/movie/8462'), 'legacy-movie');
  assert.equal(apiRoute('/find/tt0133093'), 'find');
  assert.equal(apiRoute(''), 'unknown');
  assert.equal(apiQueryString({b: 2, a: 'x y', c: undefined}), 'a=x%20y&b=2');
});
