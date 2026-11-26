import assert from 'node:assert/strict';
import {test} from 'node:test';
import {mailtoUrl, safeExternalUrl, safeMailtoUrl} from './externalUrl';

test('only public https links are opened', () => {
  assert.equal(safeExternalUrl('https://www.themoviedb.org/movie/603-the-matrix/watch?locale=IN'), 'https://www.themoviedb.org/movie/603-the-matrix/watch?locale=IN');
  for (const value of [
    'http://example.com', 'https://user:pass@example.com', 'https://example.com:8443', 'https://localhost/x', 'https://router.local',
    'https://10.0.0.1/', 'https://[::1]/', 'javascript:alert(1)', 'intent://scan', `https://example.com/${'x'.repeat(2050)}`, 42, null,
  ]) {
    assert.equal(safeExternalUrl(value), undefined, String(value).slice(0, 40));
  }
});

test('mail links need one address and may carry a subject', () => {
  assert.equal(mailtoUrl('help@example.com', 'Privacy request'), 'mailto:help@example.com?subject=Privacy%20request');
  assert.equal(safeMailtoUrl('mailto:help@example.com'), 'mailto:help@example.com');
  assert.equal(safeMailtoUrl('mailto:not an address'), undefined);
  assert.equal(mailtoUrl('nobody'), undefined);
});
