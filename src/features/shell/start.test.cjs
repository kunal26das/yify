const assert = require('node:assert/strict');
const {test} = require('node:test');
const {loadTs} = require('../../../tests/helpers/loadTs.cjs');

function loadStart() {
  const calls = [];
  const record = (name) => () => {
    calls.push(name);
  };
  const setConnectivity = () => undefined;
  const mocks = {
    '@/core/platform/network': {subscribeOnline: (listener) => {
      calls.push(listener === setConnectivity ? 'subscribeOnline(setConnectivity)' : 'subscribeOnline(?)');
      return () => undefined;
    }},
    '@/core/platform/telemetry/start': {startTelemetry: record('startTelemetry')},
    '@/core/platform/updates/storeUpdates': {startStoreUpdates: record('startStoreUpdates')},
    '@/core/query/lifecycle': {startQueryLifecycle: record('startQueryLifecycle')},
    '@/core/ui/connectivity': {setConnectivity},
    '@/core/ui/imageHost': {settleImageHost: record('settleImageHost')},
    '@/features/account/public/session': {startSession: record('startSession')},
    '@/features/library/public/migration': {migrateLocalV1: record('migrateLocalV1'), startLegacyResolution: record('startLegacyResolution')},
    '@/features/monetization/public/ads': {startAds: record('startAds')},
    '@/features/monetization/public/plus': {startPlus: record('startPlus')},
    '@/features/settings/public/consent': {startConsent: record('startConsent')},
    '@/features/settings/public/region': {startRegionDetection: record('startRegionDetection')},
    '@/features/sync/public/sync': {startSync: record('startSync')},
  };
  return {calls, start: loadTs('src/features/shell/start.ts', mocks)};
}

test('prepareLocalState migrates v1 data before settling the image host', () => {
  const {calls, start} = loadStart();
  assert.equal(start.prepareLocalState(), true);
  assert.deepEqual(calls, ['migrateLocalV1', 'settleImageHost']);
});

test('startApp runs every starter once, in the F0.5 order', () => {
  const {calls, start} = loadStart();
  start.startApp();
  start.startApp();
  assert.deepEqual(calls, [
    'startQueryLifecycle',
    'subscribeOnline(setConnectivity)',
    'startTelemetry',
    'startConsent',
    'startSession',
    'startSync',
    'startLegacyResolution',
    'startRegionDetection',
    'startPlus',
    'startAds',
    'startStoreUpdates',
  ]);
});
