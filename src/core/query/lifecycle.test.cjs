const assert = require('node:assert/strict');
const {test} = require('node:test');
const {focusManager, onlineManager} = require('@tanstack/react-query');
const {createRnMock} = require('../../../tests/helpers/rnMock.cjs');
const {loadTs} = require('../../../tests/helpers/loadTs.cjs');

function fakeNetwork(initial) {
  const listeners = new Set();
  let state = initial;
  return {
    addNetworkStateListener: (listener) => {
      listeners.add(listener);
      return {remove: () => listeners.delete(listener)};
    },
    getNetworkStateAsync: async () => state,
    emit(next) {
      state = next;
      for (const listener of listeners) listener(next);
    },
  };
}

test('the native lifecycle feeds TanStack from one shared AppState subscription and the network listener', async () => {
  const rn = createRnMock();
  const network = fakeNetwork({isConnected: true, isInternetReachable: true});
  const {startQueryLifecycle} = loadTs('src/core/query/lifecycle.ts', {'react-native': rn, 'expo-network': network});
  startQueryLifecycle();
  assert.equal(rn.AppState.addEventListener.calls.length, 1);
  rn.setAppState('background');
  assert.equal(focusManager.isFocused(), false);
  rn.setAppState('active');
  assert.equal(focusManager.isFocused(), true);
  network.emit({isConnected: true, isInternetReachable: false});
  assert.equal(onlineManager.isOnline(), false);
  network.emit({isConnected: true, isInternetReachable: true});
  assert.equal(onlineManager.isOnline(), true);
  startQueryLifecycle();
  assert.equal(rn.AppState.addEventListener.calls.length, 1);
  rn.setAppState('background');
  assert.equal(focusManager.isFocused(), false);
  rn.setAppState('active');
  focusManager.setEventListener(() => undefined);
  onlineManager.setEventListener(() => undefined);
});

test('the web lifecycle leaves the TanStack browser defaults alone', () => {
  const {startQueryLifecycle} = loadTs('src/core/query/lifecycle.web.ts');
  assert.equal(startQueryLifecycle(), undefined);
});
