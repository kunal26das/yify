import assert from 'node:assert/strict';
import {afterEach, test} from 'node:test';
import type {DiscoverParams} from '@/core/domain/search';
import {
  discoverQuery,
  fetchAvailability,
  fetchDiscover,
  fetchFind,
  fetchGenres,
  fetchLegacyMovie,
  fetchPerson,
  fetchSearch,
  fetchSeason,
  fetchTitle,
  loadAvailability,
  normalizeSearchQuery,
  postResolve,
} from './endpoints';
import {ApiError} from './errors';

const originalFetch = globalThis.fetch;
let requests: {url: string; body: string | undefined}[] = [];

function serve(routes: Record<string, (body: string | undefined) => unknown>): void {
  requests = [];
  globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
    const url = String(input);
    const body = typeof init?.body === 'string' ? init.body : undefined;
    requests.push({url, body});
    const path = new URL(url).pathname.replace('/api/v2', '');
    const route = routes[path];
    return route ? Response.json(route(body)) : Response.json({error: {code: 'not_found', message: 'x'}}, {status: 404});
  }) as typeof fetch;
}

afterEach(() => {
  globalThis.fetch = originalFetch;
});

const PARAMS: DiscoverParams = {
  type: 'movie', genres: [28, 12, 28], providers: [119, 8], monetization: ['free', 'stream'], region: 'IN', sort: 'rating',
  yearFrom: 1990, yearTo: null, ratingMin: 7.5, language: null,
};

function summary(id: number) {
  return {key: `movie:${id}`, type: 'movie', id, slug: '', title: 'T', originalTitle: 'T', year: null, releaseDate: null, overview: '',
    posterPath: null, backdropPath: null, rating: null, voteCount: 0, genreIds: [], originalLanguage: 'en'};
}

test('discover sends sorted, de-duplicated lists and a region only with service filters', () => {
  assert.deepEqual(discoverQuery(PARAMS, 2), {
    type: 'movie', page: 2, genres: '12,28', providers: '8,119', monetization: 'free,stream', region: 'IN', sort: 'rating',
    year_from: 1990, year_to: undefined, rating_min: 7.5, lang: undefined,
  });
  assert.equal(discoverQuery({...PARAMS, providers: [], monetization: []}, 1).region, undefined);
});

test('list endpoints resolve the full response and send normalised search queries', async () => {
  serve({
    '/discover': () => ({v: 2, page: 1, totalPages: 1, totalResults: 1, results: [summary(1)]}),
    '/search': () => ({v: 2, q: 'dune', type: 'movie', page: 1, totalPages: 1, totalResults: 0, results: []}),
  });
  assert.equal((await fetchDiscover(PARAMS, 1)).results.length, 1);
  assert.equal((await fetchSearch('  Dune   Part  ', 'movie', 1)).q, 'dune');
  assert.equal(new URL(requests[1].url).searchParams.get('q'), 'dune part');
  assert.equal(normalizeSearchQuery('  The   MATRIX '), 'the matrix');
});

test('detail endpoints build the documented paths and unwrap the payload', async () => {
  const movie = {...summary(603), tagline: '', genres: [], runtimeMinutes: null, certification: null, imdbId: null, status: '', homepage: null,
    cast: [], crew: [], videos: [], trailer: null, recommendations: [], collection: null,
    availability: {region: 'IN', offers: {stream: [], free: [], ads: [], rent: [], buy: []}, link: null, attribution: 'JustWatch'}};
  serve({
    '/title/movie/603': () => ({v: 2, title: movie}),
    '/title/tv/1399/season/2': () => ({v: 2, season: {key: 'tv:1399', seasonNumber: 2, name: 'S2', overview: '', airDate: null, posterPath: null, episodes: []}}),
    '/person/6384': () => ({v: 2, person: {key: 'person:6384', id: 6384, slug: '', name: 'K', biography: '', birthday: null, deathday: null,
      placeOfBirth: null, profilePath: null, knownForDepartment: null, imdbId: null, alsoKnownAs: [], knownFor: [], credits: []}}),
    '/genres': () => ({v: 2, genres: [{id: 28, name: 'Action', types: ['movie']}]}),
    '/find/tt0133093': () => ({v: 2, imdbId: 'tt0133093', match: {key: 'movie:603', slug: '', title: 'T', year: null, posterPath: null, imdbId: 'tt0133093'}}),
    '/legacy/movie/8462': () => ({v: 2, v1Id: 8462, imdbId: 'tt4154756', path: '/title/movie/299536',
      match: {key: 'movie:299536', slug: '', title: 'T', year: null, posterPath: null, imdbId: 'tt4154756'}}),
  });
  assert.equal((await fetchTitle('movie:603', 'IN')).id, 603);
  assert.ok(requests[0].url.endsWith('/api/v2/title/movie/603?region=IN'));
  assert.equal((await fetchSeason('tv:1399', 2)).seasonNumber, 2);
  assert.equal((await fetchPerson('person:6384')).id, 6384);
  assert.deepEqual((await fetchGenres()).map((genre) => genre.id), [28]);
  assert.equal((await fetchFind('tt0133093')).match.key, 'movie:603');
  assert.equal((await fetchLegacyMovie(8462)).path, '/title/movie/299536');
  await assert.rejects(fetchSeason('movie:603', 1), RangeError);
  await assert.rejects(fetchTitle('movie:9', 'IN'), (error: unknown) => error instanceof ApiError && error.status === 404);
});

test('POST bodies are sorted so equal requests share one edge cache entry', async () => {
  serve({
    '/availability': () => ({v: 2, region: 'IN', items: {}, failed: []}),
    '/resolve': () => ({v: 2, imdb: {}, v1: {}, failed: {imdb: [], v1: []}}),
  });
  await fetchAvailability('IN', ['tv:1399', 'movie:603', 'tv:1399']);
  assert.equal(requests[0].body, '{"keys":["movie:603","tv:1399"],"region":"IN"}');
  await postResolve({imdb: ['tt2', 'tt1'], v1: [{id: 9, title: null, year: null}, {id: 3, title: 'A', year: 2000}]});
  assert.equal(requests[1].body, '{"imdb":["tt1","tt2"],"v1":[{"id":3,"title":"A","year":2000},{"id":9,"title":null,"year":null}]}');
});

test('availability loads batch per region and reject keys the server could not finish', async () => {
  const offers = {stream: [], free: [], ads: [], rent: [], buy: []};
  serve({
    '/availability': (body) => {
      const {region, keys} = JSON.parse(body ?? '{}') as {region: string; keys: string[]};
      const items: Record<string, unknown> = {};
      for (const key of keys) if (key !== 'movie:2') items[key] = key === 'movie:3' ? null : {region, offers, link: null, attribution: 'JustWatch'};
      return {v: 2, region, items, failed: keys.includes('movie:2') ? ['movie:2'] : []};
    },
  });
  const results = await Promise.allSettled([
    loadAvailability('IN', 'movie:1'), loadAvailability('IN', 'movie:2'), loadAvailability('IN', 'movie:3'), loadAvailability('US', 'movie:1'),
  ]);
  assert.equal(requests.length, 2);
  assert.equal(results[0].status === 'fulfilled' ? results[0].value?.region : null, 'IN');
  assert.ok(results[1].status === 'rejected' && results[1].reason instanceof ApiError && results[1].reason.status === 503);
  assert.deepEqual(results[2], {status: 'fulfilled', value: null});
  assert.equal(results[3].status === 'fulfilled' ? results[3].value?.region : null, 'US');
});
