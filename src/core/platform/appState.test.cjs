const assert = require('node:assert/strict');
const {afterEach, test} = require('node:test');
const {createRnMock} = require('../../../tests/helpers/rnMock.cjs');
const {loadTs} = require('../../../tests/helpers/loadTs.cjs');

afterEach(() => {
  delete globalThis.document;
});

test('native keeps one AppState subscription, fans changes out once and drops it with the last listener', () => {
  const rn = createRnMock();
  const {isForeground, subscribeForeground} = loadTs('src/core/platform/appState.ts', {'react-native': rn});
  assert.equal(isForeground(), true);
  const first = [];
  const second = [];
  const stopFirst = subscribeForeground((active) => first.push(active));
  const stopSecond = subscribeForeground((active) => second.push(active));
  assert.equal(rn.AppState.addEventListener.calls.length, 1);
  rn.setAppState('background');
  rn.setAppState('inactive');
  rn.setAppState('active');
  assert.deepEqual(first, [false, true]);
  assert.deepEqual(second, [false, true]);
  stopFirst();
  rn.setAppState('background');
  assert.deepEqual(first, [false, true]);
  assert.equal(isForeground(), false);
  stopSecond();
  rn.setAppState('active');
  assert.deepEqual(second, [false, true, false]);
  subscribeForeground(() => undefined);
  assert.equal(rn.AppState.addEventListener.calls.length, 2);
});

test('web follows document visibility and is a quiet no-op without a document', () => {
  const {isForeground, subscribeForeground} = loadTs('src/core/platform/appState.web.ts');
  assert.equal(isForeground(), false);
  assert.doesNotThrow(() => subscribeForeground(() => undefined)());
  const listeners = new Map();
  globalThis.document = {
    visibilityState: 'visible',
    addEventListener: (type, listener) => listeners.set(type, listener),
    removeEventListener: (type) => listeners.delete(type),
  };
  const web = loadTs('src/core/platform/appState.web.ts');
  const seen = [];
  const stop = web.subscribeForeground((active) => seen.push(active));
  globalThis.document.visibilityState = 'hidden';
  listeners.get('visibilitychange')();
  listeners.get('visibilitychange')();
  globalThis.document.visibilityState = 'visible';
  listeners.get('visibilitychange')();
  assert.deepEqual(seen, [false, true]);
  stop();
  assert.equal(listeners.has('visibilitychange'), false);
});
