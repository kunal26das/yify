const assert = require('node:assert/strict');
const {test} = require('node:test');
const {createKit, spy} = require('./testing/kit.cjs');

test('the offline banner waits two seconds and reconnecting after it announces once', (t) => {
  t.mock.timers.enable({apis: ['setTimeout']});
  const connectivity = createKit().load('src/core/ui/connectivity.ts');
  const backOnline = spy();
  const unsubscribe = connectivity.subscribeBackOnline(backOnline);
  connectivity.setConnectivity(false);
  assert.equal(connectivity.isOnline(), false);
  t.mock.timers.tick(1999);
  connectivity.setConnectivity(true);
  assert.equal(backOnline.calls.length, 0);
  connectivity.setConnectivity(false);
  t.mock.timers.tick(2000);
  connectivity.setConnectivity(true);
  connectivity.setConnectivity(true);
  assert.equal(backOnline.calls.length, 1);
  unsubscribe();
  connectivity.setConnectivity(false);
  t.mock.timers.tick(2000);
  connectivity.setConnectivity(true);
  assert.equal(backOnline.calls.length, 1);
});
