const assert = require('node:assert/strict');
const {afterEach, test} = require('node:test');
const {environmentManager} = require('@tanstack/react-query');
const {loadTs} = require('../../../tests/helpers/loadTs.cjs');

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
});

function watch(promise) {
  const state = {settled: false, value: undefined, error: undefined};
  promise.then((value) => Object.assign(state, {settled: true, value}), (error) => Object.assign(state, {settled: true, error}));
  return state;
}

async function drain() {
  for (let turn = 0; turn < 20; turn += 1) await new Promise((resolve) => setImmediate(resolve));
}

test('every query takes the retry policy and its delay, and focus and reconnect refetches stop while the breaker is open', () => {
  let degraded = false;
  const retry = {shouldRetry: () => false, retryDelay: () => 0};
  const {createQueryClient} = loadTs('src/core/query/client.ts', {
    '@/core/api/health': {apiHealth: {degraded: () => degraded}},
    './retry': retry,
  });
  const {queries, mutations} = createQueryClient().getDefaultOptions();
  assert.equal(queries.retry, retry.shouldRetry);
  assert.equal(queries.retryDelay, retry.retryDelay);
  assert.equal(queries.staleTime, 5 * 60_000);
  assert.equal(queries.gcTime, 30 * 60_000);
  assert.equal(queries.networkMode, 'online');
  assert.equal(queries.throwOnError, false);
  assert.equal(queries.refetchOnMount, true);
  assert.deepEqual([queries.refetchOnWindowFocus(), queries.refetchOnReconnect()], [true, true]);
  degraded = true;
  assert.deepEqual([queries.refetchOnWindowFocus(), queries.refetchOnReconnect()], [false, false]);
  degraded = false;
  assert.deepEqual([queries.refetchOnWindowFocus(), queries.refetchOnReconnect()], [true, true]);
  assert.deepEqual(mutations, {retry: false, networkMode: 'online'});
});

test('the server gets a new client for every call and the app keeps one', () => {
  const {getQueryClient} = loadTs('src/core/query/client.ts');
  const server = environmentManager.isServer();
  try {
    environmentManager.setIsServer(() => true);
    assert.notEqual(getQueryClient(), getQueryClient());
    environmentManager.setIsServer(() => false);
    assert.equal(getQueryClient(), getQueryClient());
  } finally {
    environmentManager.setIsServer(() => server);
  }
});

test('a real client waits out Retry-After before its one 5xx retry and stops retrying 5xx once the breaker opens', async (t) => {
  const health = loadTs('src/core/api/health.ts');
  const errors = loadTs('src/core/api/errors.ts');
  const {apiGet} = loadTs('src/core/api/client.ts', {'./health': health, './errors': errors});
  const {createQueryClient} = loadTs('src/core/query/client.ts', {'@/core/api/health': health, '@/core/api/errors': errors});
  const replies = [];
  let calls = 0;
  globalThis.fetch = async () => {
    calls += 1;
    return replies.shift()();
  };
  const outage = (headers) => () => Response.json({error: {code: 'upstream_unavailable', message: 'down'}}, {status: 502, headers});
  const healthy = () => Response.json({v: 2, ok: true});
  const query = (name) => ({queryKey: ['v2', name], queryFn: ({signal}) => apiGet('/health', {}, (body) => body, {signal})});
  t.mock.timers.enable({apis: ['setTimeout']});
  const client = createQueryClient();
  const {queries} = client.getDefaultOptions();
  try {
    replies.push(outage({'Retry-After': '2'}), healthy);
    const recovered = watch(client.fetchQuery(query('recovered')));
    await drain();
    assert.equal(calls, 1);
    t.mock.timers.tick(1_999);
    await drain();
    assert.deepEqual([calls, recovered.settled], [1, false]);
    t.mock.timers.tick(1);
    await drain();
    assert.equal(calls, 2);
    assert.deepEqual(recovered, {settled: true, value: {v: 2, ok: true}, error: undefined});
    assert.deepEqual([health.apiHealth.degraded(), queries.refetchOnWindowFocus(), queries.refetchOnReconnect()], [false, true, true]);
    for (let index = 0; index < 3; index += 1) {
      replies.push(outage({}));
      await assert.rejects(apiGet('/health', {}, (body) => body), {status: 502});
    }
    assert.deepEqual([health.apiHealth.degraded(), queries.refetchOnWindowFocus(), queries.refetchOnReconnect()], [true, false, false]);
    replies.push(outage({'Retry-After': '2'}), healthy);
    const refused = watch(client.fetchQuery(query('refused')));
    await drain();
    t.mock.timers.tick(60_000);
    await drain();
    assert.equal(calls, 6);
    assert.equal(refused.settled, true);
    assert.ok(refused.error instanceof errors.ApiError);
    assert.deepEqual([refused.error.status, refused.error.retryAfterMs], [502, 2_000]);
  } finally {
    client.clear();
  }
});
