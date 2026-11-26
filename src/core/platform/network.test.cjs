const assert = require('node:assert/strict');
const {afterEach, test} = require('node:test');
const {createRnMock} = require('../../../tests/helpers/rnMock.cjs');
const {loadTs} = require('../../../tests/helpers/loadTs.cjs');

function fakeNetwork(states) {
  const listeners = new Set();
  const queue = [...states];
  const network = {
    reads: 0,
    removed: 0,
    addNetworkStateListener: (listener) => {
      listeners.add(listener);
      return {remove: () => {
        network.removed += 1;
        listeners.delete(listener);
      }};
    },
    getNetworkStateAsync: async () => {
      network.reads += 1;
      return queue.length > 1 ? queue.shift() : queue[0];
    },
    emit: (state) => {
      for (const listener of listeners) listener(state);
    },
  };
  return network;
}

const tick = () => new Promise((resolve) => setTimeout(resolve, 0));

afterEach(() => {
  delete globalThis.window;
  delete globalThis.navigator;
});

test('native applies the first snapshot and every change, treating unknown reachability as online', async () => {
  const rn = createRnMock();
  const network = fakeNetwork([{isConnected: false}]);
  const {isOnline, subscribeOnline} = loadTs('src/core/platform/network.ts', {'react-native': rn, 'expo-network': network});
  const seen = [];
  const stop = subscribeOnline((online) => seen.push(online));
  await tick();
  assert.deepEqual(seen, [false]);
  network.emit({isConnected: true, isInternetReachable: undefined});
  network.emit({isConnected: true, isInternetReachable: true});
  network.emit({isConnected: true, isInternetReachable: false});
  assert.deepEqual(seen, [false, true, false]);
  assert.equal(isOnline(), false);
  stop();
  assert.equal(network.removed, 1);
});

test('a snapshot that races a newer callback is read again instead of trusted', async () => {
  const rn = createRnMock();
  const network = fakeNetwork([{isConnected: true}]);
  const module = loadTs('src/core/platform/network.ts', {'react-native': rn, 'expo-network': network});
  const seen = [];
  module.subscribeOnline((online) => seen.push(online));
  await tick();
  network.reads = 0;
  let release;
  network.getNetworkStateAsync = () => {
    network.reads += 1;
    if (network.reads === 1) return new Promise((resolve) => {
      release = () => resolve({isConnected: true});
    });
    return Promise.resolve({isConnected: false});
  };
  const refresh = module.refreshNetwork();
  await tick();
  network.emit({isConnected: true, isInternetReachable: true});
  release();
  assert.equal(await refresh, false);
  assert.equal(network.reads, 2);
  assert.deepEqual(seen, [false]);
});

test('coming back to the foreground refreshes the snapshot', async () => {
  const rn = createRnMock();
  const network = fakeNetwork([{isConnected: true}]);
  const {subscribeOnline} = loadTs('src/core/platform/network.ts', {'react-native': rn, 'expo-network': network});
  subscribeOnline(() => undefined);
  await tick();
  const reads = network.reads;
  rn.setAppState('background');
  rn.setAppState('active');
  await tick();
  assert.equal(network.reads, reads + 1);
});

test('web follows navigator.onLine and the window events', () => {
  const listeners = new Map();
  globalThis.navigator = {onLine: true};
  globalThis.window = {
    addEventListener: (type, listener) => listeners.set(type, listener),
    removeEventListener: (type) => listeners.delete(type),
  };
  const {isOnline, subscribeOnline} = loadTs('src/core/platform/network.web.ts');
  const seen = [];
  const stop = subscribeOnline((online) => seen.push(online));
  globalThis.navigator.onLine = false;
  listeners.get('offline')();
  globalThis.navigator.onLine = true;
  listeners.get('online')();
  assert.deepEqual(seen, [false, true]);
  assert.equal(isOnline(), true);
  stop();
  assert.equal(listeners.size, 0);
});
