const assert = require('node:assert/strict');
const {test} = require('node:test');
const {React, act, createKit, render} = require('../testing/kit.cjs');

test('useWindowClass follows the window width', () => {
  const kit = createKit();
  const {useWindowClass} = kit.load('src/core/ui/layout/useWindowClass.ts');
  const seen = [];
  function Probe() {
    seen.push(useWindowClass());
    return null;
  }
  render(React.createElement(Probe));
  act(() => kit.rn.setWindowDimensions({width: 700}));
  act(() => kit.rn.setWindowDimensions({width: 1280}));
  assert.deepEqual(seen, ['compact', 'medium', 'expanded']);
});
