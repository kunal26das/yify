const assert = require('node:assert/strict');
const {test} = require('node:test');
const {loadTs} = require('../../../tests/helpers/loadTs.cjs');

test('the query client wires the retry policy and the breaker into every query', () => {
  const {createQueryClient, getQueryClient} = loadTs('src/core/query/client.ts');
  const {apiHealth} = loadTs('src/core/api/health.ts');
  const defaults = createQueryClient().getDefaultOptions();
  assert.equal(defaults.queries.staleTime, 5 * 60_000);
  assert.equal(defaults.queries.gcTime, 30 * 60_000);
  assert.equal(defaults.queries.networkMode, 'online');
  assert.equal(defaults.queries.throwOnError, false);
  assert.equal(defaults.queries.refetchOnMount, true);
  assert.equal(typeof defaults.queries.retry, 'function');
  assert.equal(defaults.queries.refetchOnWindowFocus(), true);
  assert.deepEqual(defaults.mutations, {retry: false, networkMode: 'online'});
  assert.notEqual(getQueryClient(), getQueryClient());
  assert.ok(apiHealth);
});
