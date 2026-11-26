const assert = require('node:assert/strict');
const {test} = require('node:test');
const {React, act, createKit, render} = require('./testing/kit.cjs');

test('the player-open flag is shared and observable', () => {
  const kit = createKit();
  const overlays = kit.load('src/core/ui/overlays.ts');
  const seen = [];
  function Probe() {
    seen.push(overlays.usePlayerOpen());
    return null;
  }
  render(React.createElement(Probe));
  act(() => overlays.setPlayerOpen(true));
  act(() => overlays.setPlayerOpen(true));
  act(() => overlays.setPlayerOpen(false));
  assert.deepEqual(seen, [false, true, false]);
  assert.equal(overlays.isPlayerOpen(), false);
});
