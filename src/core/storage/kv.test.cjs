const assert = require('node:assert/strict');
const {afterEach, test} = require('node:test');
const {loadTs} = require('../../../tests/helpers/loadTs.cjs');

function fakeKvStore() {
  const data = new Map();
  const store = {
    data,
    failing: false,
    check() {
      if (store.failing) throw new Error('SQLITE_FULL');
    },
    getItemSync(key) {
      store.check();
      return data.has(key) ? data.get(key) : null;
    },
    setItemSync(key, value) {
      store.check();
      data.set(key, value);
    },
    removeItemSync(key) {
      store.check();
      return data.delete(key);
    },
    getAllKeysSync() {
      store.check();
      return [...data.keys()];
    },
  };
  return store;
}

function fakeLocalStorage(limit = Number.POSITIVE_INFINITY) {
  const data = new Map();
  const writes = [];
  return {
    data,
    writes,
    get length() {
      return data.size;
    },
    key(index) {
      return [...data.keys()][index] ?? null;
    },
    getItem(key) {
      return data.has(key) ? data.get(key) : null;
    },
    setItem(key, value) {
      writes.push(key);
      let size = key.length + value.length;
      for (const [storedKey, storedValue] of data) {
        if (storedKey !== key) size += storedKey.length + storedValue.length;
      }
      if (size > limit) {
        const error = new Error('The quota has been exceeded.');
        error.name = 'QuotaExceededError';
        throw error;
      }
      data.set(key, value);
    },
    removeItem(key) {
      data.delete(key);
    },
  };
}

function loadNative(store) {
  return loadTs('src/core/storage/kv.ts', {'expo-sqlite/kv-store': {__esModule: true, default: store}}).kv;
}

function loadWeb() {
  return loadTs('src/core/storage/kv.web.ts').kv;
}

afterEach(() => {
  delete globalThis.window;
});

test('native kv reads and writes the expo-sqlite kv-store synchronously', () => {
  const store = fakeKvStore();
  const kv = loadNative(store);
  assert.equal(kv.getString('v2.prefs'), undefined);
  assert.equal(kv.setString('v2.prefs', '{"v":1,"d":{}}'), true);
  assert.equal(kv.setString('settings:theme', 'dark'), true);
  assert.equal(kv.getString('v2.prefs'), '{"v":1,"d":{}}');
  assert.deepEqual(kv.keys(), ['v2.prefs', 'settings:theme']);
  kv.remove('settings:theme');
  assert.deepEqual([...store.data.keys()], ['v2.prefs']);
});

test('native kv reports storage errors as a missing value, false and an empty key list', () => {
  const store = fakeKvStore();
  const kv = loadNative(store);
  kv.setString('v2.prefs', 'kept');
  store.failing = true;
  assert.equal(kv.getString('v2.prefs'), undefined);
  assert.equal(kv.setString('v2.consent', '{}'), false);
  assert.doesNotThrow(() => kv.remove('v2.prefs'));
  assert.deepEqual(kv.keys(), []);
  store.failing = false;
  assert.equal(kv.getString('v2.prefs'), 'kept');
});

test('web kv reads, writes, removes and lists localStorage keys', () => {
  const storage = fakeLocalStorage();
  globalThis.window = {localStorage: storage};
  const kv = loadWeb();
  assert.equal(kv.getString('v2.prefs'), undefined);
  assert.equal(kv.setString('v2.prefs', 'a'), true);
  assert.equal(kv.setString('plus.entitlement.v1', 'b'), true);
  assert.equal(kv.getString('v2.prefs'), 'a');
  assert.deepEqual(kv.keys(), ['v2.prefs', 'plus.entitlement.v1']);
  kv.remove('v2.prefs');
  assert.deepEqual(kv.keys(), ['plus.entitlement.v1']);
});

test('a full localStorage drops every v2.cache key and retries the write once', () => {
  const storage = fakeLocalStorage(120);
  globalThis.window = {localStorage: storage};
  const kv = loadWeb();
  assert.equal(kv.setString('v2.cache.home.IN', 'x'.repeat(30)), true);
  assert.equal(kv.setString('v2.cache.reference', 'y'.repeat(20)), true);
  assert.equal(kv.setString('v2.prefs', 'z'.repeat(10)), true);
  storage.writes.length = 0;
  assert.equal(kv.setString('v2.library.watchlist', 'w'.repeat(40)), true);
  assert.deepEqual(storage.writes, ['v2.library.watchlist', 'v2.library.watchlist']);
  assert.deepEqual(kv.keys(), ['v2.prefs', 'v2.library.watchlist']);
  assert.equal(kv.setString('v2.library.diary', 'd'.repeat(200)), false);
  assert.deepEqual(kv.keys(), ['v2.prefs', 'v2.library.watchlist']);
});

test('without window, or when localStorage throws, web kv is a quiet no-op', () => {
  const kv = loadWeb();
  assert.equal(kv.getString('v2.prefs'), undefined);
  assert.equal(kv.setString('v2.prefs', 'a'), false);
  assert.doesNotThrow(() => kv.remove('v2.prefs'));
  assert.deepEqual(kv.keys(), []);
  globalThis.window = {
    get localStorage() {
      throw new Error('SecurityError');
    },
  };
  assert.equal(kv.getString('v2.prefs'), undefined);
  assert.equal(kv.setString('v2.prefs', 'a'), false);
  assert.doesNotThrow(() => kv.remove('v2.prefs'));
  assert.deepEqual(kv.keys(), []);
  const broken = {
    length: 1,
    key() {
      throw new Error('broken');
    },
    getItem() {
      throw new Error('broken');
    },
    setItem() {
      throw new Error('broken');
    },
    removeItem() {
      throw new Error('broken');
    },
  };
  globalThis.window = {localStorage: broken};
  assert.equal(kv.getString('v2.prefs'), undefined);
  assert.equal(kv.setString('v2.prefs', 'a'), false);
  assert.doesNotThrow(() => kv.remove('v2.prefs'));
  assert.deepEqual(kv.keys(), []);
});
