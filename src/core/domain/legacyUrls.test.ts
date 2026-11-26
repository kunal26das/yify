import assert from 'node:assert/strict';
import {test} from 'node:test';
import {imdbFromShowDigits, legacyMoviesToSearch, legacyShowsToSearch} from './legacyUrls';
import {DEFAULT_SEARCH_URL_STATE, searchPath} from './search';

test('v1 /movies parameters map to a movie search', () => {
  const state = legacyMoviesToSearch({query: ' dune ', genre: 'Sci-Fi', minimum_rating: '7', sort_by: 'like_count', quality: '1080p', order_by: 'asc', focus: 'search'});
  assert.deepEqual(state, {...DEFAULT_SEARCH_URL_STATE, q: 'dune', type: 'movie', genres: [878], sort: 'popular', ratingMin: 7});
  assert.equal(searchPath(state), '/search?q=dune&type=movie&genres=878&rating_min=7');
});

test('every v1 genre and sort has its TMDB equivalent', () => {
  const genres: [string, number][] = [
    ['action', 28], ['adventure', 12], ['animation', 16], ['comedy', 35], ['crime', 80], ['documentary', 99], ['drama', 18],
    ['fantasy', 14], ['horror', 27], ['mystery', 9648], ['romance', 10749], ['sci-fi', 878], ['thriller', 53], ['war', 10752],
    ['western', 37],
  ];
  for (const [genre, id] of genres) assert.deepEqual(legacyMoviesToSearch({genre}).genres, [id], genre);
  for (const genre of ['', 'all', 'biography', 'constructor', '__proto__']) assert.deepEqual(legacyMoviesToSearch({genre}).genres, [], genre);
  const sorts: [string, string][] = [
    ['date_added', 'release'], ['year', 'release'], ['title', 'title'], ['rating', 'rating'], ['like_count', 'popular'],
    ['download_count', 'popular'], ['seeds', 'popular'], ['peers', 'popular'], ['unknown', 'popular'], ['toString', 'popular'],
  ];
  for (const [sortBy, sort] of sorts) assert.equal(legacyMoviesToSearch({sort_by: sortBy}).sort, sort, sortBy);
});

test('minimum ratings round down to half stars and drop invalid values', () => {
  const cases: [string, number | null][] = [['7', 7], ['7.4', 7], ['7.5', 7.5], ['9.9', 9.5], ['10', 10], ['0', null], ['11', null], ['abc', null], ['-1', null], ['', null]];
  for (const [input, expected] of cases) assert.equal(legacyMoviesToSearch({minimum_rating: input}).ratingMin, expected, input);
});

test('array parameters use their first value and queries are cleaned', () => {
  assert.equal(legacyMoviesToSearch({query: ['first', 'second']}).q, 'first');
  assert.equal(legacyMoviesToSearch({query: `a\u0000b${'c'.repeat(200)}`}).q.length, 100);
  const emoji = legacyMoviesToSearch({query: `${'a'.repeat(99)}\u{1F600}tail`}).q;
  assert.equal(emoji, `${'a'.repeat(99)}\u{1F600}`);
  assert.doesNotThrow(() => searchPath(legacyMoviesToSearch({query: `${'a'.repeat(99)}\u{1F600}`})));
  assert.equal(legacyMoviesToSearch({}).q, '');
  assert.equal(searchPath(legacyMoviesToSearch({})), '/search?type=movie');
});

test('v1 /shows opens the TV search', () => {
  assert.deepEqual(legacyShowsToSearch(), {...DEFAULT_SEARCH_URL_STATE, type: 'tv'});
  assert.equal(searchPath(legacyShowsToSearch()), '/search?type=tv');
});

test('v1 show links carry IMDb digits that are zero-padded to seven', () => {
  assert.equal(imdbFromShowDigits('944947'), 'tt0944947');
  assert.equal(imdbFromShowDigits('0944947'), 'tt0944947');
  assert.equal(imdbFromShowDigits('tt12345678'), 'tt12345678');
  for (const value of ['', '0', 'abc', '12345678901', 'tt', '94-4947']) assert.equal(imdbFromShowDigits(value), null, value);
});

test('search paths omit defaults and keep list separators readable', () => {
  assert.equal(searchPath({}), '/search');
  assert.equal(searchPath({q: 'the matrix & co', type: 'all', sort: 'popular'}), '/search?q=the%20matrix%20%26%20co');
  assert.equal(searchPath({
    type: 'tv', genres: [18, 80], providers: [8, 119], monetization: ['stream', 'free'], sort: 'rating',
    yearFrom: 1990, yearTo: 1999, ratingMin: 7.5, language: 'en',
  }), '/search?type=tv&genres=18,80&providers=8,119&monetization=stream,free&sort=rating&year_from=1990&year_to=1999&rating_min=7.5&lang=en');
});
