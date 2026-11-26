import assert from 'node:assert/strict';
import {test} from 'node:test';
import type {DiscoverParams} from '@/core/domain/search';
import {canonicalDiscover, queryKeys} from './keys';

const DEFAULTS: DiscoverParams = {
  type: 'tv', genres: [], providers: [], monetization: [], region: null, sort: 'popular', yearFrom: null, yearTo: null, ratingMin: null, language: null,
};

test('discover keys drop defaults and sort lists, so equal filters share one key', () => {
  assert.deepEqual(canonicalDiscover(DEFAULTS), {type: 'tv'});
  assert.deepEqual(canonicalDiscover({...DEFAULTS, region: 'IN'}), {type: 'tv'});
  const a = canonicalDiscover({...DEFAULTS, genres: [18, 10759], providers: [8, 119], monetization: ['free', 'ads'], region: 'IN', sort: 'release', yearFrom: 2000, yearTo: 2010, ratingMin: 7, language: 'hi'});
  const b = canonicalDiscover({...DEFAULTS, genres: [10759, 18, 18], providers: [119, 8], monetization: ['ads', 'free'], region: 'IN', sort: 'release', yearFrom: 2000, yearTo: 2010, ratingMin: 7, language: 'hi'});
  assert.deepEqual(a, b);
  assert.deepEqual(a, {type: 'tv', genres: [18, 10759], providers: [8, 119], monetization: ['ads', 'free'], region: 'IN', sort: 'release', yearFrom: 2000, yearTo: 2010, ratingMin: 7, language: 'hi'});
});

test('query keys are versioned and normalise search text', () => {
  assert.deepEqual(queryKeys.home('IN'), ['v2', 'home', 'IN']);
  assert.deepEqual(queryKeys.search('  The   MATRIX ', 'all'), ['v2', 'search', 'all', 'the matrix']);
  assert.deepEqual(queryKeys.title('movie:603', 'US'), ['v2', 'title', 'movie:603', 'US']);
  assert.deepEqual(queryKeys.season('tv:1399', 1), ['v2', 'season', 'tv:1399', 1]);
  assert.deepEqual(queryKeys.person('person:6384'), ['v2', 'person', 'person:6384']);
  assert.deepEqual(queryKeys.availability('IN', 'tv:1399'), ['v2', 'availability', 'IN', 'tv:1399']);
  assert.deepEqual(queryKeys.legacyMovie(8462), ['v2', 'legacy-movie', 8462]);
  assert.deepEqual([queryKeys.genres(), queryKeys.regions(), queryKeys.geo()], [['v2', 'genres'], ['v2', 'regions'], ['v2', 'geo']]);
  assert.deepEqual(queryKeys.discover(DEFAULTS), ['v2', 'discover', {type: 'tv'}]);
});
