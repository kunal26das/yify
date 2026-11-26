const assert = require('node:assert/strict');
const {test} = require('node:test');
const {loadTs} = require('../../../tests/helpers/loadTs.cjs');

test('the overlay inset is the tallest visible overlay and clears when none is left', () => {
  const properties = new Map();
  const previous = globalThis.document;
  globalThis.document = {documentElement: {style: {setProperty: (name, value) => properties.set(name, value), removeProperty: (name) => properties.delete(name)}}};
  try {
    const {setOverlayHeight} = loadTs('src/core/ui/overlayInset.web.ts');
    setOverlayHeight('snackbar', 119.2);
    assert.equal(properties.get('--overlay-height'), '120px');
    setOverlayHeight('consent', 240);
    assert.equal(properties.get('--overlay-height'), '240px');
    setOverlayHeight('consent', null);
    assert.equal(properties.get('--overlay-height'), '120px');
    setOverlayHeight('snackbar', 0);
    assert.equal(properties.has('--overlay-height'), false);
    assert.equal(loadTs('src/core/ui/overlayInset.ts').setOverlayHeight('snackbar', 10), undefined);
  } finally {
    globalThis.document = previous;
  }
});
