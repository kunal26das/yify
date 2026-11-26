import assert from 'node:assert/strict';
import {test} from 'node:test';
import {DEFAULT_CONSENT, V2_NOTICE_VERSION, consentPromptDue} from './preferences';

test('the consent prompt is due on a fresh install and for every older notice version', () => {
  assert.equal(consentPromptDue(DEFAULT_CONSENT), true);
  assert.equal(consentPromptDue({...DEFAULT_CONSENT, noticeVersion: '2026-09-25-v2', decidedAt: '2026-09-26T10:00:00.000Z'}), true);
  assert.equal(consentPromptDue({...DEFAULT_CONSENT, noticeVersion: V2_NOTICE_VERSION, decidedAt: null}), true);
});

test('any recorded answer for the current notice resolves the prompt', () => {
  const decidedAt = '2026-11-26T10:00:00.000Z';
  assert.equal(consentPromptDue({analytics: true, youtube: false, noticeVersion: V2_NOTICE_VERSION, decidedAt}), false);
  assert.equal(consentPromptDue({analytics: false, youtube: false, noticeVersion: V2_NOTICE_VERSION, decidedAt}), false);
});
