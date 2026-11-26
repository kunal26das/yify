import assert from 'node:assert/strict';
import {test} from 'node:test';
import {SITE_ORIGIN} from '@/core/config/app';
import type {TitleKey, PersonKey} from '@/core/domain/keys';
import {DEFAULT_SEARCH_URL_STATE, searchPath} from '@/core/domain/search';
import type {TitleSummary} from '@/core/domain/title';
import type {MediaCardItem} from './hrefs';
import {listHref, mediaHref, mediaTarget, personHref, searchHref, seasonHref, shareUrl, titleHref} from './hrefs';

const matrix: TitleSummary = {
  key: 'movie:603',
  type: 'movie',
  id: 603,
  slug: 'the-matrix',
  title: 'The Matrix',
  originalTitle: 'The Matrix',
  year: 1999,
  releaseDate: '1999-03-30',
  overview: '',
  posterPath: '/matrix.jpg',
  backdropPath: null,
  rating: 8.2,
  voteCount: 26000,
  genreIds: [28, 878],
  originalLanguage: 'en',
};

test('title links use the TMDB id with the slug, or the id alone', () => {
  assert.equal(titleHref('movie:603', 'the-matrix'), '/title/movie/603-the-matrix');
  assert.equal(titleHref('movie:603', ''), '/title/movie/603');
  assert.equal(titleHref('tv:1399', 'game-of-thrones'), '/title/tv/1399-game-of-thrones');
  assert.equal(titleHref('movie:603', 'The Matrix: Reloaded?/x'), '/title/movie/603-the-matrix-reloaded-x');
  for (const key of ['movie:0', 'person:1', 'movie:abc', 'show:1']) assert.throws(() => titleHref(key as TitleKey, 'x'), RangeError, key);
});

test('season links hang off the TV title link', () => {
  assert.equal(seasonHref('tv:1399', 'game-of-thrones', 1), '/title/tv/1399-game-of-thrones/season/1');
  assert.equal(seasonHref('tv:1399', '', 0), '/title/tv/1399/season/0');
  assert.throws(() => seasonHref('movie:603', 'the-matrix', 1), RangeError);
  for (const season of [-1, 1.5, 1000, Number.NaN]) assert.throws(() => seasonHref('tv:1399', '', season), RangeError, String(season));
});

test('person and list links', () => {
  assert.equal(personHref('person:6384', 'keanu-reeves'), '/person/6384-keanu-reeves');
  assert.equal(personHref('person:6384', ''), '/person/6384');
  for (const key of ['person:0', 'person:2147483648', 'movie:603', 'person:']) assert.throws(() => personHref(key as PersonKey, ''), RangeError, key);
  assert.equal(listHref('l_m3x9_abc123'), '/list/l_m3x9_abc123');
  assert.equal(listHref('c_1700000000000'), '/list/c_1700000000000');
  for (const id of ['', 'a/b', '../x', 'a b', 'x'.repeat(101)]) assert.throws(() => listHref(id), RangeError, id);
});

test('search links come from the domain serializer', () => {
  assert.equal(searchHref({}), '/search');
  assert.equal(searchHref({q: 'dune', type: 'movie'}), '/search?q=dune&type=movie');
  assert.equal(searchHref({type: 'tv', genres: [18], sort: 'popular'}), searchPath({type: 'tv', genres: [18]}));
  assert.equal(searchHref({q: 'dune\u0000', genres: [18, 18], yearFrom: 2020, yearTo: 2000}), '/search?q=dune&genres=18');
  assert.equal(searchHref(DEFAULT_SEARCH_URL_STATE), '/search');
});

test('share links put an app path on the public origin', () => {
  assert.equal(SITE_ORIGIN, 'https://yify.expo.app');
  assert.equal(shareUrl('/title/movie/603-the-matrix'), 'https://yify.expo.app/title/movie/603-the-matrix');
  assert.equal(shareUrl('/search?q=dune'), 'https://yify.expo.app/search?q=dune');
  for (const href of ['https://example.com/x', '//example.com/x', 'title/movie/603', '']) assert.throws(() => shareUrl(href), RangeError, href);
});

test('catalog cards and resolved library entries open their title page', () => {
  const card: MediaCardItem = {kind: 'title', title: matrix};
  assert.deepEqual(mediaTarget(card), {kind: 'title', key: 'movie:603', type: 'movie', id: 603, slug: 'the-matrix', title: 'The Matrix', posterPath: '/matrix.jpg'});
  assert.equal(mediaHref(card), '/title/movie/603-the-matrix');
  const entry: MediaCardItem = {kind: 'entry', key: 'tv:1399', snapshot: {title: 'Game of Thrones', year: 2011, posterPath: null, slug: 'game-of-thrones'}};
  assert.deepEqual(mediaTarget(entry), {kind: 'title', key: 'tv:1399', type: 'tv', id: 1399, slug: 'game-of-thrones', title: 'Game of Thrones', posterPath: null});
  assert.equal(mediaHref(entry), '/title/tv/1399-game-of-thrones');
});

test('unmatched v1 entries open a search for their stored title', () => {
  for (const key of ['v1:8462', 'imdb:tt0133093'] as const) {
    const item: MediaCardItem = {kind: 'entry', key, snapshot: {title: 'Old & Gold', year: null, posterPath: null, slug: ''}};
    assert.deepEqual(mediaTarget(item), {kind: 'legacy', title: 'Old & Gold'});
    assert.equal(mediaHref(item), '/search?q=Old%20%26%20Gold');
  }
});
