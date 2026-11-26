import assert from 'node:assert/strict';
import {test} from 'node:test';
import {ApiDecodeError, ApiError, isAbortError, isTransportFailure, NetworkError, TimeoutError} from './errors';

test('error classes carry their fields and names', () => {
  const api = new ApiError(503, 'upstream_rate_limited', 12_000);
  assert.ok(api instanceof Error);
  assert.equal(api.name, 'ApiError');
  assert.equal(api.message, 'upstream_rate_limited');
  assert.deepEqual([api.status, api.code, api.retryAfterMs], [503, 'upstream_rate_limited', 12_000]);
  assert.equal(new NetworkError().name, 'NetworkError');
  assert.equal(new NetworkError().message, 'network');
  assert.equal(new TimeoutError().name, 'TimeoutError');
  assert.equal(new TimeoutError().message, 'timeout');
  const decode = new ApiDecodeError('home');
  assert.equal(decode.name, 'ApiDecodeError');
  assert.equal(decode.route, 'home');
  assert.ok(!(decode instanceof ApiError));
});

test('transport failures are recognised only from the known fetch messages', () => {
  assert.equal(isTransportFailure(new TypeError('Network request failed')), true);
  assert.equal(isTransportFailure(new TypeError('Failed to fetch')), true);
  assert.equal(isTransportFailure(new TypeError('Load failed')), true);
  assert.equal(isTransportFailure(new Error('fetch failed: Unable to resolve host "yify.expo.app"')), true);
  assert.equal(isTransportFailure(new Error('fetch failed: java.net.SocketTimeoutException: timeout')), true);
  assert.equal(isTransportFailure(new TypeError('Cannot read properties of undefined')), false);
  assert.equal(isTransportFailure(new Error('fetch failed: something else')), false);
  assert.equal(isTransportFailure('Network request failed'), false);
});

test('aborts are recognised from the error name, the Expo code and the Expo messages', () => {
  const abort = new Error('aborted');
  abort.name = 'AbortError';
  assert.equal(isAbortError(abort), true);
  assert.equal(isAbortError({name: 'AbortError'}), true);
  assert.equal(isAbortError(Object.assign(new Error('x'), {code: 'ERR_FETCH_REQUEST_CANCELED'})), true);
  assert.equal(isAbortError(new Error('fetch failed: Fetch request has been canceled')), true);
  assert.equal(isAbortError(new Error('fetch failed: The operation was aborted.')), true);
  assert.equal(isAbortError(new TimeoutError()), false);
  assert.equal(isAbortError(null), false);
});
