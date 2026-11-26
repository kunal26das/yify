import assert from 'node:assert/strict';
import {afterEach, test} from 'node:test';
import {ApiDecodeError, ApiError, NetworkError, TimeoutError} from '@/core/api/errors';
import {apiHealth} from '@/core/api/health';
import {retryDelay, shouldRetry} from './retry';

afterEach(() => apiHealth.reset());

test('429 and 503 retry once when Retry-After is at most 60 s', () => {
  assert.equal(shouldRetry(0, new ApiError(429, 'rate_limited', 5_000)), true);
  assert.equal(shouldRetry(1, new ApiError(429, 'rate_limited', 5_000)), false);
  assert.equal(shouldRetry(0, new ApiError(503, 'upstream_rate_limited', null)), true);
  assert.equal(shouldRetry(0, new ApiError(503, 'upstream_rate_limited', 60_001)), false);
});

test('other server errors retry once unless the breaker is open', () => {
  assert.equal(shouldRetry(0, new ApiError(502, 'upstream_unavailable', 30_000)), true);
  assert.equal(shouldRetry(1, new ApiError(500, 'internal', 30_000)), false);
  for (let index = 0; index < 3; index += 1) apiHealth.record('server-error');
  assert.equal(apiHealth.degraded(), true);
  assert.equal(shouldRetry(0, new ApiError(504, 'upstream_timeout', 10_000)), false);
  assert.equal(shouldRetry(0, new ApiError(503, 'upstream_rate_limited', 10_000)), true);
});

test('client errors, decode errors and unknown errors never retry', () => {
  assert.equal(shouldRetry(0, new ApiError(400, 'invalid_request', null)), false);
  assert.equal(shouldRetry(0, new ApiError(404, 'not_found', null)), false);
  assert.equal(shouldRetry(0, new ApiDecodeError('home')), false);
  assert.equal(shouldRetry(0, new TypeError('x')), false);
  assert.equal(shouldRetry(0, null), false);
});

test('network failures and timeouts retry twice', () => {
  assert.equal(shouldRetry(0, new NetworkError()), true);
  assert.equal(shouldRetry(1, new TimeoutError()), true);
  assert.equal(shouldRetry(2, new NetworkError()), false);
});

test('the delay honours Retry-After, otherwise backs off with jitter up to 30 s', () => {
  assert.equal(retryDelay(0, new ApiError(429, 'rate_limited', 7_000)), 7_000);
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const base = Math.min(30_000, 2_000 * 2 ** attempt);
    for (let sample = 0; sample < 20; sample += 1) {
      const delay = retryDelay(attempt, new NetworkError());
      assert.ok(delay >= base * 0.5 && delay <= base * 1.5, `${attempt}: ${delay}`);
    }
  }
});
