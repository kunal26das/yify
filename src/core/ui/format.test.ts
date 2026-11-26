import assert from 'node:assert/strict';
import {test} from 'node:test';
import {formatRating, formatRuntime, yearSpan} from './format';

test('runtimes read as hours and minutes', () => {
  assert.equal(formatRuntime(136), '2h 16m');
  assert.equal(formatRuntime(120), '2h');
  assert.equal(formatRuntime(45), '45m');
  assert.equal(formatRuntime(0), null);
  assert.equal(formatRuntime(null), null);
  assert.equal(formatRuntime(-3), null);
  assert.equal(formatRuntime(Number.NaN), null);
});

test('ratings keep one decimal and year spans use an en dash', () => {
  assert.equal(formatRating(7.849), '7.8');
  assert.equal(formatRating(8), '8.0');
  assert.equal(formatRating(7.85), '7.9');
  assert.equal(yearSpan(2019, 2023), '2019–2023');
  assert.equal(yearSpan(2019, 2019), '2019');
  assert.equal(yearSpan(2019, null), '2019');
  assert.equal(yearSpan(null, 2020), null);
});
