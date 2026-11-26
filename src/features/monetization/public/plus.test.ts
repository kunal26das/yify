import assert from 'node:assert/strict';
import {test} from 'node:test';
import {canCreateCustomList, effectiveAccent, insightsAccess} from './plus';
import {FREE_CUSTOM_LIST_LIMIT} from './types';

test('free users create lists up to the limit and Plus members without one (C1.11)', () => {
  assert.equal(FREE_CUSTOM_LIST_LIMIT, 3);
  assert.deepEqual(canCreateCustomList({customListCount: 0, status: 'free'}), {allowed: true});
  assert.deepEqual(canCreateCustomList({customListCount: 2, status: 'free'}), {allowed: true});
  assert.deepEqual(canCreateCustomList({customListCount: 3, status: 'free'}), {allowed: false, reason: 'limit'});
  assert.deepEqual(canCreateCustomList({customListCount: 7, status: 'free'}), {allowed: false, reason: 'limit'});
  assert.deepEqual(canCreateCustomList({customListCount: 3, status: 'unknown'}), {allowed: false, reason: 'limit'});
  assert.deepEqual(canCreateCustomList({customListCount: 2, status: 'unknown'}), {allowed: true});
  assert.deepEqual(canCreateCustomList({customListCount: 250, status: 'plus'}), {allowed: true});
});

test('the stored accent applies only to Plus members, and insights are full only for them', () => {
  assert.equal(effectiveAccent({stored: 'accent2', status: 'plus', fallback: 'default'}), 'accent2');
  assert.equal(effectiveAccent({stored: 'accent2', status: 'free', fallback: 'default'}), 'default');
  assert.equal(effectiveAccent({stored: 'accent2', status: 'unknown', fallback: 'default'}), 'default');
  assert.equal(insightsAccess('plus'), 'full');
  assert.equal(insightsAccess('free'), 'teaser');
  assert.equal(insightsAccess('unknown'), 'teaser');
});
