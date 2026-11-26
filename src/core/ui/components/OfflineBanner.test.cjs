const assert = require('node:assert/strict');
const {test} = require('node:test');
const {React, act, createKit, findByProp, render, texts} = require('../testing/kit.cjs');

test('the status region is always mounted, and the offline message appears in it two seconds after the drop', (t) => {
  t.mock.timers.enable({apis: ['setTimeout']});
  const kit = createKit({web: true});
  const connectivity = kit.load('src/core/ui/connectivity.ts');
  const {OfflineBanner, OFFLINE_MESSAGE} = kit.load('src/core/ui/components/OfflineBanner.tsx', {'../connectivity': connectivity});
  const view = render(React.createElement(OfflineBanner));
  const [region] = findByProp(view.root, 'role', 'status');
  assert.deepEqual(texts(region), []);
  act(() => connectivity.setConnectivity(false));
  act(() => t.mock.timers.tick(1999));
  assert.deepEqual(texts(region), []);
  act(() => t.mock.timers.tick(1));
  assert.equal(findByProp(view.root, 'role', 'status')[0], region);
  assert.deepEqual(texts(region), [OFFLINE_MESSAGE]);
  act(() => connectivity.setConnectivity(true));
  assert.deepEqual(texts(region), []);
});
