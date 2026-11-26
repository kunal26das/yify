import assert from 'node:assert/strict';
import {test} from 'node:test';
import {isLocalDate, isWatchDate, localToday} from './dates';

test('local dates are real calendar days from 1900 on', () => {
  assert.equal(isLocalDate('2024-02-29'), true);
  assert.equal(isLocalDate('1900-01-01'), true);
  for (const value of ['2026-02-29', '2026-13-01', '2026-09-31', '1899-12-31', '2026-9-19', '', 20260919, null, undefined]) {
    assert.equal(isLocalDate(value), false, String(value));
  }
});

test('today is the device calendar date, and watch dates cannot be in the future', () => {
  const now = new Date(2026, 8, 19, 12).getTime();
  assert.equal(localToday(now), '2026-09-19');
  assert.equal(localToday(new Date(2026, 0, 1, 0, 0).getTime()), '2026-01-01');
  assert.equal(isWatchDate('2026-09-19', now), true);
  assert.equal(isWatchDate('2025-12-31', now), true);
  assert.equal(isWatchDate('2026-09-20', now), false);
  assert.equal(isWatchDate('2026-02-30', now), false);
});
