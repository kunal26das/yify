const assert = require('node:assert/strict');
const {test} = require('node:test');
const {loadTs} = require('../../../../tests/helpers/loadTs.cjs');

function sink() {
  const calls = {count: [], breadcrumb: [], capture: []};
  return {
    calls,
    module: {
      TELEMETRY_PLATFORM: 'android',
      sentryCount: (...args) => calls.count.push(args),
      sentryBreadcrumb: (...args) => calls.breadcrumb.push(args),
      sentryCapture: (...args) => calls.capture.push(args),
    },
  };
}

test('every operation becomes a metric and a breadcrumb; only unexpected outcomes become one error per kind', () => {
  const {calls, module} = sink();
  const {reportOperation, EXPECTED_OUTCOMES} = loadTs('src/core/platform/telemetry/operations.ts', {'./sentry': module});
  reportOperation('api.home', 'http_5xx', {attributes: {ms: 12}});
  reportOperation('purchases.purchase', 'cancelled', {attributes: {sdk_code: 'PURCHASE_CANCELLED'}});
  assert.deepEqual(calls.count, [
    ['yify.operation', {ms: 12, operation: 'api.home', outcome: 'http_5xx', platform: 'android'}],
    ['yify.operation', {sdk_code: 'PURCHASE_CANCELLED', operation: 'purchases.purchase', outcome: 'cancelled', platform: 'android'}],
  ]);
  assert.deepEqual(calls.breadcrumb, [['operation', 'api.home http_5xx'], ['operation', 'purchases.purchase cancelled']]);
  assert.deepEqual(calls.capture, []);
  const failure = new Error('bad body');
  reportOperation('api.title', 'invalid_response', {error: failure});
  reportOperation('api.title', 'invalid_response', {error: new Error('again')});
  reportOperation('api.title', 'http_4xx');
  assert.equal(calls.capture.length, 2);
  assert.equal(calls.capture[0][0], failure);
  assert.deepEqual(calls.capture[0][1], {operation: 'api.title', outcome: 'invalid_response'});
  assert.equal(calls.capture[1][0].name, 'OperationError');
  assert.equal(calls.capture[1][0].message, 'api.title http_4xx');
  reportOperation('Bad Name', 'unknown');
  assert.equal(calls.count.length, 5);
  assert.equal(EXPECTED_OUTCOMES.has('unknown'), false);
  assert.equal(EXPECTED_OUTCOMES.has('no_fill'), true);
});
