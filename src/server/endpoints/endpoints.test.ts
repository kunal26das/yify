import assert from 'node:assert/strict';
import {afterEach, beforeEach, test} from 'node:test';
import {availabilityRoute} from './availability';
import {discoverRoute} from './discover';
import {findRoute} from './find';
import {genresRoute} from './genres';
import {countryFromHeader, geoRoute} from './geo';
import {healthRoute} from './health';
import {homeRoute} from './home';
import {imageRoute} from './image';
import {legacyMovieRoute} from './legacyMovie';
import {personRoute} from './person';
import {providersRoute} from './providers';
import {regionsRoute} from './regions';
import {resolveRoute} from './resolve';
import {searchRoute} from './search';
import {seasonRoute} from './season';
import {titleRoute} from './title';

const originalLog = console.log;

beforeEach(() => {
  console.log = () => undefined;
});

afterEach(() => {
  console.log = originalLog;
});

function get(path: string, headers: Record<string, string> = {}): Request {
  return new Request(`https://yify.expo.app/api/v2${path}`, {headers});
}

function post(path: string, body: unknown): Request {
  return new Request(`https://yify.expo.app/api/v2${path}`, {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(body)});
}

async function json(response: Response): Promise<any> {
  return response.json();
}

test('home answers the region fixture, falls back to US data and requires a region', async () => {
  const india = await homeRoute(get('/home?region=IN'), {});
  assert.equal(india.status, 200);
  assert.equal(india.headers.get('x-yify-source'), 'fixture');
  assert.match(india.headers.get('cache-control') ?? '', /^public, max-age=300, s-maxage=900/);
  const body = await json(india);
  assert.equal(body.region, 'IN');
  assert.ok(body.rails.length >= 5);
  assert.equal((await json(await homeRoute(get('/home?region=GB'), {}))).region, 'GB');
  assert.equal((await homeRoute(get('/home'), {})).status, 400);
  assert.equal((await homeRoute(get('/home?region=IN&x=1'), {})).status, 400);
});

test('discover returns the fixture page for any valid parameters', async () => {
  const movies = await json(await discoverRoute(get('/discover?type=movie&genres=28&sort=rating&page=3'), {}));
  assert.ok(movies.results.every((item: {type: string}) => item.type === 'movie'));
  const shows = await json(await discoverRoute(get('/discover?type=tv'), {}));
  assert.ok(shows.results.every((item: {type: string}) => item.type === 'tv'));
  assert.equal((await discoverRoute(get('/discover?type=movie&providers=8'), {})).status, 400);
});

test('search filters the fixture titles and people by a case-insensitive substring', async () => {
  const dune = await json(await searchRoute(get('/search?q=DUNE&type=all&page=1'), {}));
  assert.deepEqual(dune.results.map((result: {title: {key: string}}) => result.title.key).sort(), ['movie:438631', 'movie:693134']);
  assert.equal(dune.q, 'DUNE');
  const keanu = await json(await searchRoute(get('/search?q=keanu&type=person'), {}));
  assert.deepEqual(keanu.results.map((result: {person: {key: string}}) => result.person.key), ['person:6384']);
  const thrones = await json(await searchRoute(get('/search?q=thrones&type=movie'), {}));
  assert.equal(thrones.totalResults, 0);
  assert.match((await searchRoute(get('/search?q=matrix'), {})).headers.get('cache-control') ?? '', /^public, max-age=300, s-maxage=3600/);
  assert.equal((await searchRoute(get('/search?q=%20'), {})).status, 400);
});

test('title answers the three fixtures with the requested region and 404s everything else', async () => {
  const matrix = await json(await titleRoute(get('/title/movie/603?region=IN'), {type: 'movie', id: '603'}));
  assert.equal(matrix.title.key, 'movie:603');
  assert.equal(matrix.title.availability.region, 'IN');
  assert.ok(matrix.title.availability.offers.stream.length + matrix.title.availability.offers.rent.length > 0);
  const thrones = await json(await titleRoute(get('/title/tv/1399?region=GB'), {type: 'tv', id: '1399'}));
  assert.equal(thrones.title.type, 'tv');
  assert.deepEqual(thrones.title.availability, {region: 'GB', offers: {stream: [], free: [], ads: [], rent: [], buy: []}, link: null, attribution: 'JustWatch'});
  const missing = await titleRoute(get('/title/movie/1?region=IN'), {type: 'movie', id: '1'});
  assert.equal(missing.status, 404);
  assert.equal(missing.headers.get('cache-control'), 'public, max-age=3600, s-maxage=86400');
  assert.equal((await titleRoute(get('/title/movie/603'), {type: 'movie', id: '603'})).status, 400);
  assert.equal((await titleRoute(get('/title/anime/603?region=IN'), {type: 'anime', id: '603'})).status, 400);
  assert.equal((await titleRoute(get('/title/tv/603?region=IN'), {type: 'tv', id: '603'})).status, 404);
});

test('season and person answer their fixtures', async () => {
  const season = await json(await seasonRoute(get('/title/tv/1399/season/1'), {type: 'tv', id: '1399', season: '1'}));
  assert.equal(season.season.episodes.length, 10);
  assert.equal((await seasonRoute(get('/title/tv/1399/season/2'), {type: 'tv', id: '1399', season: '2'})).status, 404);
  assert.equal((await seasonRoute(get('/title/movie/603/season/1'), {type: 'movie', id: '603', season: '1'})).status, 404);
  const person = await personRoute(get('/person/6384'), {id: '6384'});
  assert.match(person.headers.get('cache-control') ?? '', /^public, max-age=3600, s-maxage=86400/);
  assert.equal((await json(person)).person.name, 'Keanu Reeves');
  assert.equal((await personRoute(get('/person/1'), {id: '1'})).status, 404);
});

test('reference routes answer genres, regions and providers', async () => {
  assert.ok((await json(await genresRoute(get('/genres'), {}))).genres.length > 10);
  assert.ok((await json(await regionsRoute(get('/regions'), {}))).regions.some((region: {code: string}) => region.code === 'IN'));
  const providers = await providersRoute(get('/providers?region=US'), {});
  assert.match(providers.headers.get('cache-control') ?? '', /^public, max-age=86400/);
  assert.equal((await json(providers)).region, 'US');
  assert.equal((await json(await providersRoute(get('/providers?region=BR'), {}))).region, 'BR');
  assert.equal((await providersRoute(get('/providers'), {})).status, 400);
});

test('availability answers known keys, null for unknown ones and validates the body', async () => {
  const response = await availabilityRoute(post('/availability', {region: 'IN', keys: ['movie:603', 'tv:1399', 'movie:1']}), {});
  assert.equal(response.status, 200);
  assert.match(response.headers.get('cache-control') ?? '', /^public, max-age=0, s-maxage=21600/);
  const body = await json(response);
  assert.equal(body.items['movie:603'].region, 'IN');
  assert.equal(body.items['movie:1'], null);
  assert.deepEqual(body.failed, []);
  const elsewhere = await json(await availabilityRoute(post('/availability', {region: 'JP', keys: ['movie:603']}), {}));
  assert.equal(elsewhere.items['movie:603'].region, 'JP');
  const tooMany = await availabilityRoute(post('/availability', {region: 'IN', keys: Array.from({length: 41}, (_, index) => `movie:${index + 1}`)}), {});
  assert.equal(tooMany.status, 413);
  assert.equal((await availabilityRoute(post('/availability', {region: 'IN'}), {})).status, 400);
});

test('find, legacy movie and resolve answer from the mapping fixtures', async () => {
  assert.equal((await json(await findRoute(get('/find/tt0944947'), {imdbId: 'tt0944947'}))).match.key, 'tv:1399');
  assert.equal((await findRoute(get('/find/tt0000001'), {imdbId: 'tt0000001'})).status, 404);
  const legacy = await json(await legacyMovieRoute(get('/legacy/movie/8462'), {v1Id: '8462'}));
  assert.equal(legacy.path, '/title/movie/299536-avengers-infinity-war');
  assert.equal((await legacyMovieRoute(get('/legacy/movie/1'), {v1Id: '1'})).status, 404);
  const resolved = await json(await resolveRoute(post('/resolve', {imdb: ['tt0133093', 'tt0000001'], v1: [{id: 8462, title: 'Avengers: Infinity War', year: 2018}, {id: 5}]}), {}));
  assert.equal(resolved.imdb.tt0133093.key, 'movie:603');
  assert.equal(resolved.imdb.tt0000001, null);
  assert.equal(resolved.v1['8462'].key, 'movie:299536');
  assert.equal(resolved.v1['5'], null);
  assert.deepEqual(resolved.failed, {imdb: [], v1: []});
});

test('geo reads the EAS country header, health reports fixtures and images are not proxied yet', async () => {
  const geo = await geoRoute(get('/geo', {'eas-ip-country': 'in'}), {});
  assert.equal(geo.headers.get('cache-control'), 'private, no-store');
  assert.deepEqual(await json(geo), {v: 2, country: 'IN'});
  assert.equal(countryFromHeader('XX'), null);
  assert.equal(countryFromHeader('T1'), null);
  assert.equal(countryFromHeader(null), null);
  const health = await healthRoute(get('/health'), {});
  assert.equal(health.headers.get('cache-control'), 'private, no-store');
  assert.deepEqual(await json(health), {v: 2, ok: true, upstream: 'ok', legacy: 'ok', tmdbKey: 'fixtures'});
  assert.equal((await imageRoute(get('/img/w342/abcdef.jpg'), {size: 'w342', file: 'abcdef.jpg'})).status, 404);
  assert.equal((await imageRoute(get('/img/original/abcdef.jpg'), {size: 'original', file: 'abcdef.jpg'})).status, 400);
});
