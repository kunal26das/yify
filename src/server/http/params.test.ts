import assert from 'node:assert/strict';
import {test} from 'node:test';
import {
  availabilityRequest,
  discoverParams,
  genresParam,
  idParam,
  imageFileParam,
  imageSizeParam,
  imdbIdParam,
  monetizationParam,
  pageParam,
  queryParams,
  ratingParam,
  readJsonBody,
  regionParam,
  RequestError,
  resolveRequest,
  searchQueryParam,
  seasonParam,
  v1IdParam,
} from './params';

function rejects(work: () => unknown, status: number): void {
  assert.throws(work, (error: unknown) => error instanceof RequestError && error.status === status);
}

test('unknown and duplicated query parameters are rejected', () => {
  assert.deepEqual(queryParams(new URL('https://x/api/v2/home?region=IN'), ['region']), {region: 'IN'});
  rejects(() => queryParams(new URL('https://x/api/v2/home?region=IN&debug=1'), ['region']), 400);
  rejects(() => queryParams(new URL('https://x/api/v2/home?region=IN&region=US'), ['region']), 400);
});

test('path and query values follow the validation table', () => {
  assert.equal(regionParam('IN'), 'IN');
  for (const value of [undefined, 'in', 'IND', 'I1']) rejects(() => regionParam(value), 400);
  assert.equal(idParam('2147483647'), 2147483647);
  for (const value of ['0', '01', '2147483648', '12a', undefined]) rejects(() => idParam(value), 400);
  assert.equal(seasonParam('0'), 0);
  assert.equal(seasonParam('500'), 500);
  for (const value of ['501', '00', '-1']) rejects(() => seasonParam(value), 400);
  assert.equal(pageParam(undefined), 1);
  assert.equal(pageParam('500'), 500);
  for (const value of ['0', '501', '1.5']) rejects(() => pageParam(value), 400);
  assert.equal(searchQueryParam('  Dune   Part   Two '), 'Dune Part Two');
  for (const value of [undefined, '   ', 'a'.repeat(101), 'bad\u0007']) rejects(() => searchQueryParam(value), 400);
  assert.deepEqual(genresParam('28,12'), [28, 12]);
  for (const value of ['28,28', '1,2,3,4,5,6', 'x', '0']) rejects(() => genresParam(value), 400);
  assert.deepEqual(monetizationParam('stream,free'), ['stream', 'free']);
  for (const value of ['stream,stream', 'flatrate', '']) rejects(() => monetizationParam(value), 400);
  assert.equal(ratingParam('7.5'), 7.5);
  for (const value of ['7.2', '11', '10.5']) rejects(() => ratingParam(value), 400);
  assert.equal(imdbIdParam('tt0133093'), 'tt0133093');
  rejects(() => imdbIdParam('tt12'), 400);
  assert.equal(v1IdParam('8462'), 8462);
  assert.equal(imageSizeParam('w342'), 'w342');
  rejects(() => imageSizeParam('original'), 400);
  assert.equal(imageFileParam('abcdef.jpg'), 'abcdef.jpg');
  rejects(() => imageFileParam('logo.svg'), 400);
});

test('discover checks the year range and needs a region with service filters', () => {
  const parsed = discoverParams(new URL('https://x/api/v2/discover?type=tv&page=2&genres=18&providers=8,119&region=IN&sort=release&year_from=1990&year_to=1999&rating_min=7&lang=hi'));
  assert.equal(parsed.page, 2);
  assert.deepEqual(parsed.params, {type: 'tv', genres: [18], providers: [8, 119], monetization: [], region: 'IN', sort: 'release',
    yearFrom: 1990, yearTo: 1999, ratingMin: 7, language: 'hi'});
  rejects(() => discoverParams(new URL('https://x/api/v2/discover?type=movie&year_from=2000&year_to=1999')), 400);
  rejects(() => discoverParams(new URL('https://x/api/v2/discover?type=movie&providers=8')), 400);
  rejects(() => discoverParams(new URL('https://x/api/v2/discover?type=anime')), 400);
  rejects(() => discoverParams(new URL('https://x/api/v2/discover?type=movie&sort=seeds')), 400);
});

function jsonRequest(body: string, type = 'application/json'): Request {
  return new Request('https://x/api/v2/availability', {method: 'POST', headers: {'Content-Type': type}, body});
}

test('POST bodies must be JSON and at most 16 KiB', async () => {
  assert.deepEqual(await readJsonBody(jsonRequest('{"a":1}', 'application/json; charset=utf-8')), {a: 1});
  await assert.rejects(readJsonBody(jsonRequest('{"a":1}', 'text/plain')), (error: unknown) => error instanceof RequestError && error.status === 400);
  await assert.rejects(readJsonBody(jsonRequest('{"a":')), (error: unknown) => error instanceof RequestError && error.status === 400);
  await assert.rejects(readJsonBody(jsonRequest(`"${'x'.repeat(16_384)}"`)), (error: unknown) => error instanceof RequestError && error.status === 413);
});

test('availability and resolve bodies are validated and capped', () => {
  assert.deepEqual(availabilityRequest({region: 'IN', keys: ['movie:603', 'tv:1399']}), {region: 'IN', keys: ['movie:603', 'tv:1399']});
  rejects(() => availabilityRequest({region: 'IN', keys: []}), 400);
  rejects(() => availabilityRequest({region: 'IN', keys: ['movie:603', 'movie:603']}), 400);
  rejects(() => availabilityRequest({region: 'IN', keys: ['imdb:tt0133093']}), 400);
  rejects(() => availabilityRequest({region: 'IN', keys: ['movie:1'], extra: true}), 400);
  rejects(() => availabilityRequest({region: 'IN', keys: Array.from({length: 41}, (_, index) => `movie:${index + 1}`)}), 413);
  assert.deepEqual(resolveRequest({imdb: ['tt0133093'], v1: [{id: 8462, title: 'Avengers: Infinity War', year: 2018}]}),
    {imdb: ['tt0133093'], v1: [{id: 8462, title: 'Avengers: Infinity War', year: 2018}]});
  assert.deepEqual(resolveRequest({v1: [{id: 1}]}), {imdb: [], v1: [{id: 1, title: null, year: null}]});
  rejects(() => resolveRequest({imdb: [], v1: []}), 400);
  rejects(() => resolveRequest({imdb: ['tt0133093', 'tt0133093']}), 400);
  rejects(() => resolveRequest({v1: [{id: 1}, {id: 1}]}), 400);
  rejects(() => resolveRequest({imdb: Array.from({length: 21}, (_, index) => `tt${String(index).padStart(7, '0')}`)}), 413);
});
