import assert from 'node:assert/strict';
import {beforeEach, test} from 'node:test';
import {
  decodeAvailabilityResponse,
  decodeDiscoverResponse,
  decodeFindResponse,
  decodeGenresResponse,
  decodeGeoResponse,
  decodeHealthResponse,
  decodeHomeResponse,
  decodeLegacyMovieResponse,
  decodePersonResponse,
  decodeProvidersResponse,
  decodeRegionAvailability,
  decodeResolveResponse,
  decodeSearchResponse,
  decodeSeasonResponse,
  decodeTitleResponse,
  decodeTitleSummary,
} from './decode';
import {ApiDecodeError} from './errors';
import {clearSummaries, getSummary} from './summaryCache';

function summary(id: number, type: 'movie' | 'tv' = 'movie') {
  return {
    key: `${type}:${id}`, type, id, slug: `title-${id}`, title: `Title ${id}`, originalTitle: `Title ${id}`, year: 2001,
    releaseDate: '2001-02-03', overview: 'Overview.', posterPath: '/poster12.jpg', backdropPath: null, rating: 7.5,
    voteCount: 120, genreIds: [28, 12], originalLanguage: 'en',
  };
}

function offers() {
  return {stream: [{id: 8, name: 'Service', logoPath: '/logo1234.png', priority: 1}], free: [], ads: [], rent: [], buy: []};
}

function availability(region = 'IN') {
  return {region, offers: offers(), link: null, attribution: 'JustWatch'};
}

function video() {
  return {key: 'vKQi3bBA1y8', type: 'Trailer', name: 'Trailer', official: true, language: 'en', publishedAt: '2021-11-23T17:00:12.000Z'};
}

function movie() {
  return {
    ...summary(603), tagline: 'Tagline', genres: [{id: 28, name: 'Action', types: ['movie']}], runtimeMinutes: 136, certification: 'R',
    imdbId: 'tt0133093', status: 'Released', homepage: null,
    cast: [{personKey: 'person:6384', personId: 6384, slug: 'keanu-reeves', name: 'Keanu Reeves', character: 'Neo', profilePath: null, episodeCount: null}],
    crew: [{personKey: 'person:9340', personId: 9340, slug: 'lana-wachowski', name: 'Lana Wachowski', job: 'Director', department: 'Directing', profilePath: null}],
    videos: [video()], trailer: video(), recommendations: [summary(604)], availability: availability(), collection: {id: 2344, name: 'Collection'},
  };
}

function show() {
  return {
    ...movie(), ...summary(1399, 'tv'), collection: undefined, seasons: [{seasonNumber: 1, name: 'Season 1', episodeCount: 10, airDate: null, posterPath: null}],
    numberOfSeasons: 8, numberOfEpisodes: 73, inProduction: false, lastAirDate: '2019-05-19', nextEpisode: null,
    lastEpisode: {seasonNumber: 8, episodeNumber: 6, name: 'Finale', airDate: '2019-05-19'},
    networks: [{id: 49, name: 'Network', logoPath: null}], createdBy: [{personKey: 'person:9813', name: 'Creator'}],
  };
}

beforeEach(() => clearSummaries());

test('a wrong top-level shape throws ApiDecodeError naming the route', () => {
  for (const body of [null, [], {}, {v: 1}, 'v2']) {
    assert.throws(() => decodeHomeResponse(body), (error: unknown) => error instanceof ApiDecodeError && error.route === 'home');
  }
  assert.throws(() => decodeHomeResponse({v: 2, region: 'IN', generatedAt: 'now', hero: {}, rails: []}), ApiDecodeError);
  assert.throws(() => decodeDiscoverResponse({v: 2, page: 0, totalPages: 1, totalResults: 1, results: []}), ApiDecodeError);
  assert.throws(() => decodeSearchResponse({v: 2, q: 'x', type: 'anime', page: 1, totalPages: 1, totalResults: 0, results: []}), ApiDecodeError);
  assert.throws(() => decodeTitleResponse({v: 2, title: {...movie(), availability: null}}), ApiDecodeError);
  assert.throws(() => decodeTitleResponse({v: 2, title: {...movie(), collection: {id: 'x'}}}), ApiDecodeError);
  assert.throws(() => decodeProvidersResponse({v: 2, region: 'india', providers: []}), ApiDecodeError);
  assert.throws(() => decodeGeoResponse({v: 2, country: 'india'}), ApiDecodeError);
  assert.throws(() => decodeHealthResponse({v: 2, ok: true, upstream: 'down', legacy: 'ok', tmdbKey: 'env'}), ApiDecodeError);
  assert.throws(() => decodeFindResponse({v: 2, imdbId: '133093', match: {}}), ApiDecodeError);
  assert.throws(() => decodeLegacyMovieResponse({v: 2, v1Id: 8462, imdbId: 'tt4154756', match: {key: 'movie:1', slug: '', title: 'x', year: null, posterPath: null, imdbId: null}, path: '/movie/8462'}), ApiDecodeError);
});

test('invalid list items are dropped one by one and unknown rails are ignored', () => {
  const home = decodeHomeResponse({
    v: 2, region: 'IN', generatedAt: '2026-11-26T10:00:00.000Z',
    hero: [{...summary(1), trailer: video()}, {...summary(2), trailer: {key: 'short'}}, {...summary(3), trailer: null}],
    rails: [
      {id: 'trending', kind: 'ranked', items: [summary(4), {...summary(5), key: 'movie:6'}, {...summary(7), title: ''}, summary(8, 'tv')]},
      {id: 'anime', kind: 'posters', items: [summary(9)]},
      {id: 'acclaimed', kind: 'grid', items: []},
    ],
  });
  assert.deepEqual(home.hero.map((item) => [item.key, item.trailer?.key ?? null]), [['movie:1', 'vKQi3bBA1y8'], ['movie:3', null]]);
  assert.deepEqual(home.rails.map((rail) => [rail.id, rail.items.map((item) => item.key)]), [['trending', ['movie:4', 'tv:8']]]);
});

test('every summary a decoder sees lands in the summary cache', () => {
  decodeSearchResponse({v: 2, q: 'x', type: 'all', page: 1, totalPages: 1, totalResults: 2, results: [
    {kind: 'title', title: summary(10)},
    {kind: 'person', person: {key: 'person:1', id: 1, slug: 'name', name: 'Name', profilePath: null, knownForDepartment: 'Acting', knownFor: [summary(11, 'tv')]}},
    {kind: 'company', company: {}},
  ]});
  assert.equal(getSummary('movie:10')?.title, 'Title 10');
  assert.equal(getSummary('tv:11')?.type, 'tv');
  decodeTitleResponse({v: 2, title: movie()});
  assert.deepEqual(Object.keys(getSummary('movie:603') ?? {}).sort(), Object.keys(summary(603)).sort());
  assert.equal(getSummary('movie:604')?.id, 604);
});

test('summaries reject inconsistent keys, bad years and ratings but keep valid genre ids only', () => {
  assert.equal(decodeTitleSummary({...summary(1), type: 'tv'}), null);
  assert.equal(decodeTitleSummary({...summary(1), year: 99}), null);
  assert.equal(decodeTitleSummary({...summary(1), rating: 11}), null);
  assert.equal(decodeTitleSummary({...summary(1), voteCount: -1}), null);
  assert.deepEqual(decodeTitleSummary({...summary(1), genreIds: [28, 'x', 0, 12]})?.genreIds, [28, 12]);
});

test('movie and TV details decode their own fields and drop bad credits', () => {
  const decodedMovie = decodeTitleResponse({v: 2, title: {...movie(), cast: [...movie().cast, {personKey: 'person:2', personId: 3, name: 'x'}]}}).title;
  assert.equal(decodedMovie.type, 'movie');
  assert.equal(decodedMovie.type === 'movie' ? decodedMovie.collection?.name : null, 'Collection');
  assert.equal(decodedMovie.cast.length, 1);
  const decodedShow = decodeTitleResponse({v: 2, title: show()}).title;
  assert.equal(decodedShow.type, 'tv');
  if (decodedShow.type !== 'tv') return;
  assert.equal(decodedShow.nextEpisode, null);
  assert.deepEqual(decodedShow.lastEpisode, {seasonNumber: 8, episodeNumber: 6, name: 'Finale', airDate: '2019-05-19'});
  assert.deepEqual(decodedShow.createdBy, [{personKey: 'person:9813', name: 'Creator'}]);
  assert.equal(Object.hasOwn(decodedShow, 'collection'), false);
});

test('seasons and people decode, keeping only valid episodes and credits', () => {
  const season = decodeSeasonResponse({v: 2, season: {key: 'tv:1399', seasonNumber: 1, name: 'Season 1', overview: '', airDate: null, posterPath: null, episodes: [
    {id: 1, seasonNumber: 1, episodeNumber: 1, name: 'One', overview: '', airDate: null, runtimeMinutes: 60, stillPath: null, rating: 8.2},
    {id: 0, seasonNumber: 1, episodeNumber: 2, name: 'Two', overview: '', airDate: null, runtimeMinutes: null, stillPath: null, rating: null},
  ]}}).season;
  assert.deepEqual(season.episodes.map((episode) => episode.name), ['One']);
  assert.throws(() => decodeSeasonResponse({v: 2, season: {...season, key: 'movie:1'}}), ApiDecodeError);
  const person = decodePersonResponse({v: 2, person: {
    key: 'person:6384', id: 6384, slug: 'keanu-reeves', name: 'Keanu Reeves', biography: '', birthday: '1964-09-02', deathday: null,
    placeOfBirth: null, profilePath: null, knownForDepartment: 'Acting', imdbId: 'nm0000206', alsoKnownAs: ['K', 3], knownFor: [summary(603)],
    credits: [{title: summary(603), character: 'Neo', jobs: [], episodeCount: null}, {title: {}, character: null, jobs: [], episodeCount: null}],
  }}).person;
  assert.deepEqual(person.alsoKnownAs, ['K']);
  assert.equal(person.credits.length, 1);
});

test('availability keeps valid keys and null answers and drops the rest', () => {
  const response = decodeAvailabilityResponse({v: 2, region: 'IN', items: {
    'movie:603': availability(), 'tv:1399': null, 'movie:x': availability(), 'movie:1': {...availability(), attribution: 'Other'},
  }, failed: ['movie:2', 'bad', 3]});
  assert.deepEqual(Object.keys(response.items).sort(), ['movie:603', 'tv:1399']);
  assert.equal(response.items['tv:1399'], null);
  assert.deepEqual(response.failed, ['movie:2']);
  assert.equal(decodeRegionAvailability({...availability(''), offers: offers()})?.region, '');
  assert.equal(decodeRegionAvailability({...availability(), offers: {stream: []}}), null);
});

test('reference, mapping, geo and health responses decode', () => {
  assert.deepEqual(decodeGenresResponse({v: 2, genres: [{id: 28, name: 'Action', types: ['movie', 'anime']}, {id: 'x'}]}).genres, [{id: 28, name: 'Action', types: ['movie']}]);
  assert.equal(decodeProvidersResponse({v: 2, region: 'US', providers: [{id: 8, name: 'S', logoPath: null, priority: 1, types: ['tv']}]}).providers.length, 1);
  const match = {key: 'movie:603', slug: 'the-matrix', title: 'The Matrix', year: 1999, posterPath: null, imdbId: 'tt0133093'};
  assert.equal(decodeFindResponse({v: 2, imdbId: 'tt0133093', match}).match.key, 'movie:603');
  assert.equal(decodeLegacyMovieResponse({v: 2, v1Id: 8462, imdbId: 'tt4154756', match, path: '/title/movie/603-the-matrix'}).v1Id, 8462);
  const resolved = decodeResolveResponse({v: 2, imdb: {tt0133093: match, tt0000001: null, nope: match}, v1: {8462: match, x: match}, failed: {imdb: ['tt0944947', 'bad'], v1: [1, -1]}});
  assert.deepEqual(Object.keys(resolved.imdb).sort(), ['tt0000001', 'tt0133093']);
  assert.deepEqual(Object.keys(resolved.v1), ['8462']);
  assert.deepEqual(resolved.failed, {imdb: ['tt0944947'], v1: [1]});
  assert.equal(decodeGeoResponse({v: 2, country: null}).country, null);
  assert.equal(decodeHealthResponse({v: 2, ok: true, upstream: 'ok', legacy: 'retired', tmdbKey: 'fixtures'}).tmdbKey, 'fixtures');
});
