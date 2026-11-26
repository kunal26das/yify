import assert from 'node:assert/strict';
import {afterEach, beforeEach, test} from 'node:test';
import {UpstreamError} from '@/server/tmdb/client';
import {invalidRequest, notFound} from './params';
import {KB, preflight, publicHost, withApi} from './respond';

const originalLog = console.log;
let lines: Record<string, unknown>[] = [];

beforeEach(() => {
  lines = [];
  console.log = (line: string) => {
    lines.push(JSON.parse(line));
  };
});

afterEach(() => {
  console.log = originalLog;
});

function request(path = '/api/v2/home', headers: Record<string, string> = {}): Request {
  return new Request(`https://yify--abc.expo.app${path}`, {headers});
}

test('a result becomes JSON with the cache policy, the source header and one log line', async () => {
  const route = withApi('home', {deadlineMs: 1000, maxBytes: KB}, async ({budget, publicHost: host, params}) => {
    assert.equal(budget.remaining, 40);
    return {body: {v: 2, host, region: params.region}, policy: 'list', source: 'fixture'};
  });
  const response = await route(request('/api/v2/home', {'x-forwarded-host': 'yify.expo.app', 'eas-colo': 'bom'}), {region: 'IN'});
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('content-type'), 'application/json; charset=utf-8');
  assert.equal(response.headers.get('x-content-type-options'), 'nosniff');
  assert.equal(response.headers.get('cache-control'), 'public, max-age=300, s-maxage=900, stale-while-revalidate=3600, stale-if-error=604800');
  assert.equal(response.headers.get('x-yify-source'), 'fixture');
  assert.equal(response.headers.get('access-control-allow-origin'), null);
  assert.deepEqual(await response.json(), {v: 2, host: 'yify.expo.app', region: 'IN'});
  assert.equal(lines.length, 1);
  assert.deepEqual({...lines[0], ms: 0}, {t: 'api', route: 'home', status: 200, ms: 0, source: 'fixture', colo: 'bom'});
});

test('request errors map to the envelope with the error cache policy', async () => {
  const bad = withApi('search', {deadlineMs: 1000, maxBytes: KB}, async () => {
    throw invalidRequest('q is missing.');
  });
  const response = await bad(request(), {});
  assert.equal(response.status, 400);
  assert.equal(response.headers.get('cache-control'), 'public, max-age=60, s-maxage=3600');
  assert.equal(response.headers.get('retry-after'), null);
  assert.deepEqual(await response.json(), {error: {code: 'invalid_request', message: 'q is missing.'}});
  const missing = await withApi('title', {deadlineMs: 1000, maxBytes: KB}, async () => {
    throw notFound();
  })(request(), {});
  assert.equal(missing.status, 404);
  assert.equal(missing.headers.get('cache-control'), 'public, max-age=3600, s-maxage=86400');
});

test('upstream failures map to 404, 502, 503 and 504 with Retry-After', async () => {
  const cases: [UpstreamError, number, string, string | null][] = [
    [new UpstreamError('not_found', 404, null), 404, 'not_found', null],
    [new UpstreamError('rate_limited', 429, 120), 503, 'upstream_rate_limited', '60'],
    [new UpstreamError('rate_limited', 429, null), 503, 'upstream_rate_limited', '10'],
    [new UpstreamError('unavailable', 503, null), 502, 'upstream_unavailable', '30'],
    [new UpstreamError('auth', 401, null), 502, 'upstream_unavailable', '30'],
    [new UpstreamError('invalid', 200, null), 502, 'upstream_unavailable', '30'],
    [new UpstreamError('timeout', null, null), 504, 'upstream_timeout', '10'],
  ];
  for (const [error, status, code, retryAfter] of cases) {
    const response = await withApi('title', {deadlineMs: 1000, maxBytes: KB}, async () => {
      throw error;
    })(request(), {});
    assert.equal(response.status, status, error.failure);
    assert.equal(response.headers.get('retry-after'), retryAfter, error.failure);
    const body = await response.json();
    assert.equal(body.error.code, code);
    assert.equal(body.error.retryAfterSeconds, retryAfter === null ? undefined : Number(retryAfter));
    if (status >= 500) assert.equal(response.headers.get('cache-control'), 'no-store');
  }
});

test('unexpected errors are 500 internal, oversized bodies too, and slow handlers hit the deadline', async () => {
  const crash = await withApi('home', {deadlineMs: 1000, maxBytes: KB}, async () => {
    throw new TypeError('bug');
  })(request(), {});
  assert.equal(crash.status, 500);
  assert.equal(crash.headers.get('retry-after'), '30');
  assert.equal((await crash.json()).error.code, 'internal');
  const big = await withApi('find', {deadlineMs: 1000, maxBytes: 10}, async () => ({body: {v: 2, padding: 'x'.repeat(50)}, policy: 'mapping'}))(request(), {});
  assert.equal(big.status, 500);
  assert.ok(lines.some((line) => line.alert === 'oversize'));
  let seen: AbortSignal | null = null;
  const slow = await withApi('home', {deadlineMs: 10, maxBytes: KB}, async ({signal}) => {
    seen = signal;
    await new Promise((resolve) => setTimeout(resolve, 40));
    return {body: {v: 2}, policy: 'list'};
  })(request(), {});
  assert.equal(slow.status, 504);
  assert.equal(slow.headers.get('retry-after'), '10');
  assert.equal(seen?.aborted, true);
  await new Promise((resolve) => setTimeout(resolve, 40));
});

test('preflight answers 204 without CORS headers, and the public host comes from X-Forwarded-Host', () => {
  const response = preflight('POST');
  assert.equal(response.status, 204);
  assert.equal(response.headers.get('allow'), 'POST, OPTIONS');
  assert.equal(response.headers.get('access-control-allow-origin'), null);
  assert.equal(publicHost(request('/', {'x-forwarded-host': 'YIFY--V2.expo.app, edge'})), 'yify--v2.expo.app');
  assert.equal(publicHost(request()), 'yify.expo.app');
});
