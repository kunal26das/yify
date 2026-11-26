const assert = require('node:assert/strict');
const {test} = require('node:test');
const {loadTs} = require('../../../../tests/helpers/loadTs.cjs');

const NOW = Date.UTC(2026, 10, 27, 12);
const HOUR = 60 * 60 * 1000;
const CHECKED_AT = NOW + 10_000;
const {APP_NAME} = loadTs('src/core/config/app.ts');
const {KEYS} = loadTs('src/core/storage/keys.ts');

const AVAILABLE = {updateAvailable: true, storeVersion: '117', serverPriority: 0, flexibleAllowed: true, immediateAllowed: true};

function flush() {
  return new Promise((resolve) => setImmediate(resolve));
}

function setup(t, {info = AVAILABLE, storage = {}, foreground = true, playerOpen = false, startError = null} = {}) {
  t.mock.timers.enable({apis: ['setTimeout', 'Date'], now: NOW});
  const store = new Map(Object.entries(storage));
  const updateListeners = new Map();
  const foregroundListeners = new Set();
  const playerListeners = new Set();
  const state = {foreground, playerOpen, info};
  const calls = {checks: 0, starts: [], snackbars: [], events: [], operations: [], writes: []};
  const mocks = {
    'expo-in-app-updates': {
      checkForUpdate: async () => {
        calls.checks += 1;
        if (state.info instanceof Error) throw state.info;
        return state.info;
      },
      startUpdate: async (...args) => {
        calls.starts.push(args);
        if (startError) throw startError;
        return true;
      },
      addUpdateListener: (name, listener) => {
        updateListeners.set(name, listener);
        return () => updateListeners.delete(name);
      },
    },
    '@/core/platform/appState': {
      isForeground: () => state.foreground,
      subscribeForeground: (listener) => {
        foregroundListeners.add(listener);
        return () => foregroundListeners.delete(listener);
      },
    },
    '@/core/platform/telemetry/events': {track: (event) => calls.events.push(event)},
    '@/core/platform/telemetry/operations': {reportOperation: (...args) => calls.operations.push(args)},
    '@/core/storage/kv': {
      kv: {
        getString: (key) => store.get(key),
        setString: (key, value) => {
          calls.writes.push([key, value]);
          store.set(key, value);
          return true;
        },
        remove: (key) => store.delete(key),
        keys: () => [...store.keys()],
      },
    },
    '@/core/ui/components/SnackbarHost': {showSnackbar: (request) => calls.snackbars.push(request)},
    '@/core/ui/overlays': {
      isPlayerOpen: () => state.playerOpen,
      subscribePlayerOpen: (listener) => {
        playerListeners.add(listener);
        return () => playerListeners.delete(listener);
      },
    },
  };
  const updates = loadTs('src/core/platform/updates/storeUpdates.ts', mocks);
  return {
    updates,
    calls,
    store,
    state,
    emit: (name, payload = {}) => updateListeners.get(name)(payload),
    setForeground(active) {
      state.foreground = active;
      for (const listener of [...foregroundListeners]) listener(active);
    },
    setPlayerOpen(open) {
      state.playerOpen = open;
      for (const listener of [...playerListeners]) listener();
    },
    async start() {
      updates.startStoreUpdates();
      t.mock.timers.tick(updates.STORE_UPDATE_DELAY_MS);
      await flush();
    },
  };
}

test('the check waits 10 s after the first render, for the foreground and a closed trailer, once per cold start', async (t) => {
  const app = setup(t, {foreground: false, playerOpen: true});
  app.updates.startStoreUpdates();
  app.updates.startStoreUpdates();
  t.mock.timers.tick(app.updates.STORE_UPDATE_DELAY_MS - 1);
  await flush();
  assert.equal(app.calls.checks, 0);
  t.mock.timers.tick(1);
  await flush();
  assert.equal(app.calls.checks, 0);
  app.setForeground(true);
  await flush();
  assert.equal(app.calls.checks, 0);
  app.setPlayerOpen(false);
  await flush();
  assert.equal(app.calls.checks, 1);
  app.setForeground(false);
  app.setForeground(true);
  app.setPlayerOpen(true);
  app.setPlayerOpen(false);
  await flush();
  assert.equal(app.calls.checks, 1);
  assert.deepEqual(app.calls.starts, [[false]]);
});

test('no update, or a failed check, prompts nothing and reports an expected store outcome', async (t) => {
  const none = setup(t, {info: {updateAvailable: false}});
  await none.start();
  assert.deepEqual(none.calls.starts, []);
  assert.deepEqual(none.calls.writes, []);
  t.mock.timers.reset();
  const error = new Error('Failed to check for updates: -10: Install Error(-10)');
  const failing = setup(t, {info: error});
  await failing.start();
  assert.deepEqual(failing.calls.starts, []);
  assert.deepEqual(failing.calls.snackbars, []);
  assert.deepEqual(failing.calls.operations, [['updates.store', 'store', {error, attributes: {stage: 'check'}}]]);
});

test('a store version is prompted at most once every 72 hours', async (t) => {
  const recent = setup(t, {storage: {[KEYS.updatesPrompted('117')]: String(NOW - 71 * HOUR)}});
  await recent.start();
  assert.deepEqual(recent.calls.starts, []);
  assert.equal(recent.store.get(KEYS.updatesPrompted('117')), String(NOW - 71 * HOUR));
  t.mock.timers.reset();
  const stale = setup(t, {storage: {[KEYS.updatesPrompted('117')]: String(NOW - 72 * HOUR)}});
  await stale.start();
  assert.deepEqual(stale.calls.starts, [[false]]);
  assert.equal(stale.store.get(KEYS.updatesPrompted('117')), String(CHECKED_AT));
  t.mock.timers.reset();
  const otherVersion = setup(t, {info: {...AVAILABLE, storeVersion: '118'}, storage: {[KEYS.updatesPrompted('117')]: String(NOW - HOUR)}});
  await otherVersion.start();
  assert.deepEqual(otherVersion.calls.starts, [[false]]);
  t.mock.timers.reset();
  const future = setup(t, {storage: {[KEYS.updatesPrompted('117')]: String(NOW + HOUR)}});
  await future.start();
  assert.deepEqual(future.calls.starts, [[false]]);
});

test('an immediate update starts only at priority 4 or higher when Play allows it', async (t) => {
  const cases = [
    [{serverPriority: 3, immediateAllowed: true, flexibleAllowed: true}, [[false]]],
    [{serverPriority: 4, immediateAllowed: true, flexibleAllowed: true}, [[true]]],
    [{serverPriority: 5, immediateAllowed: true, flexibleAllowed: false}, [[true]]],
    [{serverPriority: 5, immediateAllowed: false, flexibleAllowed: true}, [[false]]],
    [{serverPriority: 4, immediateAllowed: false, flexibleAllowed: false}, []],
    [{serverPriority: undefined, immediateAllowed: true, flexibleAllowed: true}, [[false]]],
  ];
  for (const [overrides, expected] of cases) {
    const app = setup(t, {info: {...AVAILABLE, ...overrides}});
    await app.start();
    assert.deepEqual(app.calls.starts, expected, JSON.stringify(overrides));
    t.mock.timers.reset();
  }
});

test('an interrupted immediate update resumes without the throttle while a flexible download is left to finish', async (t) => {
  const throttled = {[KEYS.updatesPrompted('117')]: String(NOW - HOUR)};
  const immediate = setup(t, {info: {updateAvailable: true, updateInProgress: true, installStatus: 2, storeVersion: '117', serverPriority: 4}, storage: throttled});
  await immediate.start();
  assert.deepEqual(immediate.calls.starts, [[]]);
  assert.deepEqual(immediate.calls.snackbars, []);
  t.mock.timers.reset();
  const flexible = setup(t, {info: {updateAvailable: true, updateInProgress: true, installStatus: 2, storeVersion: '117', serverPriority: 1}, storage: throttled});
  await flexible.start();
  assert.deepEqual(flexible.calls.starts, []);
  assert.deepEqual(flexible.calls.snackbars, []);
  flexible.emit('updateDownloaded', {readyToInstall: true});
  assert.equal(flexible.calls.snackbars.at(-1).message, `Update ready. Restart ${APP_NAME} to finish.`);
  assert.deepEqual(flexible.calls.starts, []);
});

test('a flexible download shows progress, then waits for a Restart tap or the background to install', async (t) => {
  const app = setup(t);
  await app.start();
  assert.deepEqual(app.calls.starts, [[false]]);
  app.emit('updateStart', {updateType: 'FLEXIBLE'});
  assert.deepEqual(app.calls.snackbars, [{message: `Downloading an update to ${APP_NAME}…`, duration: 'short', key: 'store-update'}]);
  app.emit('updateDownloaded', {readyToInstall: true});
  assert.equal(app.store.get(KEYS.updatesDownloaded('117')), String(CHECKED_AT));
  const ready = app.calls.snackbars.at(-1);
  assert.equal(ready.message, `Update ready. Restart ${APP_NAME} to finish.`);
  assert.equal(ready.duration, 'indefinite');
  assert.equal(ready.action.label, 'Restart');
  assert.deepEqual(app.calls.starts, [[false]]);
  t.mock.timers.tick(24 * HOUR);
  await flush();
  assert.deepEqual(app.calls.starts, [[false]]);
  ready.action.onPress();
  assert.deepEqual(app.calls.starts, [[false], [false]]);
  app.setForeground(false);
  assert.deepEqual(app.calls.starts, [[false], [false], [false]]);
  app.setForeground(true);
  assert.deepEqual(app.calls.starts, [[false], [false], [false]]);
  assert.deepEqual(app.calls.events.map((event) => event.params), [{type: 'flexible', result: 'started'}]);
});

test('a cold start with a downloaded update shows Restart instead of calling startUpdate', async (t) => {
  const downloaded = setup(t, {info: {updateAvailable: true, updateInProgress: true, installStatus: 11, storeVersion: '117', serverPriority: 5}});
  await downloaded.start();
  assert.deepEqual(downloaded.calls.starts, []);
  assert.equal(downloaded.calls.snackbars.length, 1);
  assert.equal(downloaded.calls.snackbars[0].action.label, 'Restart');
  assert.equal(downloaded.store.get(KEYS.updatesDownloaded('117')), String(CHECKED_AT));
  downloaded.setForeground(false);
  assert.deepEqual(downloaded.calls.starts, [[false]]);
  t.mock.timers.reset();
  const flagged = setup(t, {
    info: {updateAvailable: true, updateInProgress: true, installStatus: 3, storeVersion: '117', serverPriority: 5},
    storage: {[KEYS.updatesDownloaded('117')]: String(NOW - HOUR)},
  });
  await flagged.start();
  assert.deepEqual(flagged.calls.starts, []);
  assert.equal(flagged.calls.snackbars.length, 1);
  assert.equal(flagged.store.get(KEYS.updatesDownloaded('117')), String(NOW - HOUR));
  t.mock.timers.reset();
  const discarded = setup(t, {storage: {[KEYS.updatesDownloaded('117')]: String(NOW - HOUR)}});
  await discarded.start();
  assert.deepEqual(discarded.calls.starts, [[false]]);
  discarded.setForeground(false);
  assert.deepEqual(discarded.calls.starts, [[false]]);
});

test('declined, installed and failed flows are recorded as store_update events', async (t) => {
  const app = setup(t, {info: {...AVAILABLE, serverPriority: 4}});
  await app.start();
  app.emit('updateStart', {updateType: 'IMMEDIATE'});
  app.emit('updateCancelled', {reason: 'User cancelled from system dialog'});
  app.emit('updateCompleted', {});
  assert.deepEqual(app.calls.snackbars, []);
  assert.deepEqual(app.calls.events, [
    {name: 'store_update', params: {type: 'immediate', result: 'started'}},
    {name: 'store_update', params: {type: 'immediate', result: 'declined'}},
    {name: 'store_update', params: {type: 'immediate', result: 'installed'}},
  ]);
  t.mock.timers.reset();
  const error = new Error('Failed to start update flow: activity missing');
  const failing = setup(t, {startError: error});
  await failing.start();
  await flush();
  assert.deepEqual(failing.calls.events, [{name: 'store_update', params: {type: 'flexible', result: 'failed'}}]);
  assert.deepEqual(failing.calls.operations, [['updates.store', 'store', {error, attributes: {stage: 'start'}}]]);
});

test('the web twin never touches Play in-app updates', () => {
  assert.equal(loadTs('src/core/platform/updates/storeUpdates.web.ts').startStoreUpdates(), undefined);
});
