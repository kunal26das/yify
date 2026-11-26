const assert = require('node:assert/strict');
const {test} = require('node:test');
const {createRnMock} = require('../../../../tests/helpers/rnMock.cjs');
const {loadTs} = require('../../../../tests/helpers/loadTs.cjs');

test('startTelemetry registers the API observer once and applies consent to analytics', () => {
  const reports = [];
  const applied = [];
  let observer = null;
  const consent = loadTs('src/core/platform/telemetry/consent.ts');
  const start = loadTs('src/core/platform/telemetry/start.ts', {
    'react-native': createRnMock(),
    'expo-network': {addNetworkStateListener: () => ({remove: () => undefined}), getNetworkStateAsync: async () => ({isConnected: true})},
    '@/core/api/client': {setApiObserver: (next) => {
      observer = next;
    }},
    './analytics': {applyAnalyticsConsent: (value) => applied.push(value)},
    './consent': consent,
    './operations': {reportOperation: (...args) => reports.push(args)},
  });
  start.startTelemetry();
  start.startTelemetry();
  assert.deepEqual(applied, [false]);
  consent.applyTelemetryConsent(true);
  assert.deepEqual(applied, [false, true]);
  observer({route: 'legacy-movie', status: 404, ms: 12.4});
  observer({route: 'home', status: 503, ms: 30});
  observer({route: 'title', status: 'decode', ms: 5});
  assert.deepEqual(reports, [
    ['api.legacy_movie', 'http_404', {attributes: {ms: 12}}],
    ['api.home', 'http_5xx', {attributes: {ms: 30}}],
    ['api.title', 'invalid_response', {attributes: {ms: 5}}],
  ]);
});

test('API outcomes map to the operation catalogue', () => {
  const start = loadTs('src/core/platform/telemetry/start.ts', {
    'react-native': createRnMock(),
    'expo-network': {addNetworkStateListener: () => ({remove: () => undefined}), getNetworkStateAsync: async () => ({isConnected: true})},
    '@/core/api/client': {setApiObserver: () => undefined},
    './analytics': {applyAnalyticsConsent: () => undefined},
    './operations': {reportOperation: () => undefined},
  });
  const outcome = (status, online = true) => start.apiOutcome({route: 'home', status, ms: 1}, online);
  assert.deepEqual([200, 404, 429, 500, 504, 400, 413].map((status) => outcome(status)), ['ok', 'http_404', 'http_429', 'http_5xx', 'http_5xx', 'http_4xx', 'http_4xx']);
  assert.equal(outcome('network'), 'network');
  assert.equal(outcome('network', false), 'offline');
  assert.equal(outcome('timeout'), 'timeout');
  assert.equal(start.apiOperation('img'), 'api.img');
});
