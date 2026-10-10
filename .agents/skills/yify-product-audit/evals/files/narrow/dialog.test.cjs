const assert = require('node:assert/strict');
const test = require('node:test');
const { closeLabel } = require('./dialog.cjs');

test('names the dialog being closed', () => {
  assert.equal(closeLabel('Journal'), 'Close Journal');
  assert.equal(closeLabel('Watchlist controls'), 'Close Watchlist controls');
});
