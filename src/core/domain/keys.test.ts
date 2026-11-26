import assert from 'node:assert/strict';
import {test} from 'node:test';
import {MAX_TMDB_ID, isEntryKey, isLegacyKey, parseTitleKey, personKey, titleKey} from './keys';

test('title keys round-trip and reject ids outside TMDB range', () => {
  assert.equal(titleKey('movie', 603), 'movie:603');
  assert.deepEqual(parseTitleKey('tv:1399'), {type: 'tv', id: 1399, key: 'tv:1399'});
  assert.deepEqual(parseTitleKey(`movie:${MAX_TMDB_ID}`), {type: 'movie', id: MAX_TMDB_ID, key: `movie:${MAX_TMDB_ID}`});
  for (const value of ['movie:0', 'movie:01', `movie:${MAX_TMDB_ID + 1}`, 'person:1', 'movie:1.5', 'movie:', 'MOVIE:1', ' movie:1']) {
    assert.equal(parseTitleKey(value), null, value);
  }
  for (const id of [0, -1, 1.5, MAX_TMDB_ID + 1, Number.NaN]) {
    assert.throws(() => titleKey('movie', id), RangeError);
    assert.throws(() => personKey(id), RangeError);
  }
  assert.equal(personKey(6384), 'person:6384');
});

test('legacy keys cover v1 ids and IMDb codes, and entry keys accept both kinds', () => {
  for (const value of ['v1:8462', 'imdb:tt0133093', 'imdb:tt12345678']) {
    assert.equal(isLegacyKey(value), true, value);
    assert.equal(isEntryKey(value), true, value);
  }
  for (const value of ['v1:0', 'imdb:tt123', 'imdb:0133093', 'yts:8462', 'movie:603']) assert.equal(isLegacyKey(value), false, value);
  assert.equal(isEntryKey('movie:603'), true);
  assert.equal(isEntryKey('person:603'), false);
});
