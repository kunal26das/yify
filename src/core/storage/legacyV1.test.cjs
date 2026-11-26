const assert = require('node:assert/strict');
const {test} = require('node:test');
const {loadTs} = require('../../../tests/helpers/loadTs.cjs');

function memoryStore(initial = {}) {
  const data = new Map(Object.entries(initial));
  return {
    data,
    getString: (key) => data.get(key),
    setString: (key, value) => {
      data.set(key, value);
      return true;
    },
    remove: (key) => {
      data.delete(key);
    },
    keys: () => [...data.keys()],
  };
}

function load(defaultStore = memoryStore()) {
  return loadTs('src/core/storage/legacyV1.ts', {'./kv': {kv: defaultStore}});
}

const V1_DEVICE = {
  'privacy:choices': '{"analytics":true}',
  'settings:theme': 'light',
  'settings:watchRegion': 'IN',
  'settings:streamingServices': '{"IN":["tmdb:8"]}',
  'settings:historyPaused': 'false',
  'settings:playback': '{"trailerCaptions":true}',
  'settings:notifications': '{}',
  'settings:confirmWatchlistRemoval': 'true',
  'settings:browseDefaults': '{}',
  'settings:notify': '{}',
  'watchlist:items': '[]',
  'watchlist:funnel_saved_milestones_v1': '[1]',
  'library:state': '{"version":1}',
  'library:mutationBlocked': 'true',
  'history:state': '{"version":1}',
  'journal:account:uidA': '{"version":1,"entries":{}}',
  'journal:account:uidB': '{"version":1,"entries":{"j_1":{}}}',
  'journal:deleted:uidB': 'true',
  'journal:deleted:uidC': 'false',
  'search:search.recents': '["dune"]',
  'purchases:ads_removed:v2:uidA': '{"adsRemoved":true,"expiresAt":null}',
  'purchases:app_user_id': '$RCAnonymousID:abc',
  'sync:watchlistMarks': '{"version":2}',
  'sync:linkedUid': 'uidA',
  'sync:libraryUid': 'uidA',
  'sync:libraryTransition': '{"uid":"uidB","state":"{}"}',
  'sync:preferencesUpdatedAt': '1700000000000',
  'sync:libraryAccount:uidB': '{"version":1}',
  'sync:deletedAccount:uidC': 'true',
  'sync:lastSyncedAt': '1700000000001',
  'nudge:state': '{}',
  'nudge:discovery_dismissed': 'true',
  'nudge:first_home_visit': '1',
  'streaming:tmdb-availability-v1': '[]',
  'streaming:tmdb-catalog-v1': '{}',
  'streaming:tmdb-regions-v1': '{}',
  'availability-alerts:device': 'x',
  'availability-alerts:owner': 'x',
  'availability-alerts:country': 'x',
  'availability-alerts:consent': 'x',
  'new-movies:daily-pick-ledger': '[]',
  'new-movies:notification-catalog:1080p': '[]',
  'notification-delivery:last-daily-date': '2026-11-01',
  'notification-delivery:last-arrival-id': '1',
  'v2.prefs': '{"v":1,"d":{}}',
  'plus.entitlement.v1': '{}',
  'firebase:host': 'unrelated',
};

test('v1 data is detected by its namespaces only', () => {
  const {hasV1Data, V1_KEY_PATTERN} = load();
  assert.equal(hasV1Data(memoryStore(V1_DEVICE)), true);
  assert.equal(hasV1Data(memoryStore({'v2.prefs': '{}', 'plus.entitlement.v1': '{}', 'firebase:host': 'x', 'settings': 'x'})), false);
  for (const key of Object.keys(V1_DEVICE).filter((name) => name.includes(':') && !name.startsWith('firebase:'))) {
    assert.match(key, V1_KEY_PATTERN, key);
  }
});

test('the v1 snapshot reads every source and enumerates account-scoped keys', () => {
  const {readV1Snapshot} = load();
  const snapshot = readV1Snapshot(memoryStore(V1_DEVICE));
  assert.deepEqual(snapshot.values, {
    privacyChoices: '{"analytics":true}',
    theme: 'light',
    watchRegion: 'IN',
    streamingServices: '{"IN":["tmdb:8"]}',
    historyPaused: 'false',
    playback: '{"trailerCaptions":true}',
    watchlistItems: '[]',
    watchlistMarks: '{"version":2}',
    library: '{"version":1}',
    history: '{"version":1}',
    recentSearches: '["dune"]',
    linkedUid: 'uidA',
    libraryUid: 'uidA',
    libraryTransition: '{"uid":"uidB","state":"{}"}',
    preferencesUpdatedAt: '1700000000000',
  });
  assert.deepEqual(snapshot.journals, [
    {uid: 'uidA', value: '{"version":1,"entries":{}}'},
    {uid: 'uidB', value: '{"version":1,"entries":{"j_1":{}}}'},
  ]);
  assert.deepEqual(snapshot.libraryAccounts, [{uid: 'uidB', value: '{"version":1}'}]);
  assert.deepEqual(snapshot.deletedJournals, ['uidB']);
  assert.deepEqual(snapshot.deletedAccounts, ['uidC']);
  assert.deepEqual(readV1Snapshot(memoryStore({'journal:account:': '{}'})), {values: {}, journals: [], libraryAccounts: [], deletedJournals: [], deletedAccounts: []});
});

test('phase A frees only removed-feature and cache keys', () => {
  const {removeRetiredV1Keys} = load();
  const store = memoryStore(V1_DEVICE);
  removeRetiredV1Keys(store);
  assert.deepEqual([...store.data.keys()].sort(), [
    'firebase:host',
    'history:state',
    'journal:account:uidA',
    'journal:account:uidB',
    'journal:deleted:uidB',
    'journal:deleted:uidC',
    'library:state',
    'plus.entitlement.v1',
    'privacy:choices',
    'purchases:ads_removed:v2:uidA',
    'search:search.recents',
    'settings:historyPaused',
    'settings:playback',
    'settings:streamingServices',
    'settings:theme',
    'settings:watchRegion',
    'sync:deletedAccount:uidC',
    'sync:lastSyncedAt',
    'sync:libraryAccount:uidB',
    'sync:libraryTransition',
    'sync:libraryUid',
    'sync:linkedUid',
    'sync:preferencesUpdatedAt',
    'sync:watchlistMarks',
    'v2.prefs',
    'watchlist:items',
  ]);
});

test('the 30-day cleanup removes the v1 backup but leaves purchases and v2 data', () => {
  const {removeV1Backup, removeV1PurchaseKeys} = load();
  const store = memoryStore(V1_DEVICE);
  removeV1Backup(store);
  const remaining = [...store.data.keys()].filter((key) => /^(privacy|settings|library|watchlist|history|journal|search|sync):/.test(key));
  assert.deepEqual(remaining, []);
  assert.equal(store.data.has('purchases:ads_removed:v2:uidA'), true);
  assert.equal(store.data.has('v2.prefs'), true);
  assert.equal(store.data.has('plus.entitlement.v1'), true);
  removeV1PurchaseKeys(store);
  assert.equal([...store.data.keys()].some((key) => key.startsWith('purchases:')), false);
  assert.equal(store.data.has('v2.prefs'), true);
});

test('the v1 entitlement cache is read per uid for a provisional grant', () => {
  const store = memoryStore({
    'purchases:ads_removed:v2:uidA': '{"adsRemoved":true,"expiresAt":null}',
    'purchases:ads_removed:v2:user%2F1': '{"adsRemoved":true,"expiresAt":"2026-12-01T00:00:00Z"}',
    'purchases:ads_removed:v2:revoked': '{"adsRemoved":false,"expiresAt":"2026-10-01T00:00:00.000Z"}',
    'purchases:ads_removed:v2:noExpiry': '{"adsRemoved":true}',
    'purchases:ads_removed:v2:badDate': '{"adsRemoved":true,"expiresAt":"someday"}',
    'purchases:ads_removed:v2:badFlag': '{"adsRemoved":"true","expiresAt":null}',
    'purchases:ads_removed:v2:corrupt': '{"adsRemoved":',
  });
  const {readV1EntitlementCache} = load(store);
  assert.deepEqual(readV1EntitlementCache('uidA'), {adsRemoved: true, expiresAt: null});
  assert.deepEqual(readV1EntitlementCache('user/1'), {adsRemoved: true, expiresAt: '2026-12-01T00:00:00Z'});
  assert.deepEqual(readV1EntitlementCache('revoked', store), {adsRemoved: false, expiresAt: '2026-10-01T00:00:00.000Z'});
  for (const uid of ['noExpiry', 'badDate', 'badFlag', 'corrupt', 'missing', '']) assert.equal(readV1EntitlementCache(uid), null, uid);
  assert.equal(readV1EntitlementCache('uidA', memoryStore()), null);
});
