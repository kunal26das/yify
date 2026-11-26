import assert from 'node:assert/strict';
import {readdirSync, readFileSync} from 'node:fs';
import {join} from 'node:path';
import {test} from 'node:test';
import {fileURLToPath} from 'node:url';
import {
  decodeAvailabilityResponse,
  decodeDiscoverResponse,
  decodeFindResponse,
  decodeGenresResponse,
  decodeHomeResponse,
  decodeLegacyMovieResponse,
  decodePaged,
  decodePersonResponse,
  decodePersonSummary,
  decodeProvidersResponse,
  decodeRegionsResponse,
  decodeSearchResponse,
  decodeSeasonResponse,
  decodeTitleResponse,
} from '@/core/api/decode';
import {titleHref} from '@/core/navigation/hrefs';
import policy from '../policy/bannedStrings.cjs';

const FIXTURES = fileURLToPath(new URL('../../src/server/fixtures/v2/', import.meta.url));
const KB = 1024;

const EXPECTED = [
  'availability.IN.json', 'availability.US.json', 'discover.movie.json', 'discover.tv.json', 'find.json', 'genres.json',
  'home.IN.json', 'home.US.json', 'legacyMovie.json', 'people.popular.json', 'person.6384.json', 'providers.IN.json',
  'providers.US.json', 'regions.json', 'search.json', 'season.tv.1399.1.json', 'title.movie.299536.json',
  'title.movie.603.json', 'title.tv.1399.json',
];

type Decoder = (body: unknown) => unknown;

function records(decode: Decoder): Decoder {
  return (body) => {
    assert.equal(typeof body, 'object');
    assert.ok(body !== null && !Array.isArray(body));
    return Object.fromEntries(Object.entries(body).map(([key, value]) => [key, decode(value)]));
  };
}

const RULES: readonly {pattern: RegExp; decode: Decoder; maxBytes: number}[] = [
  {pattern: /^home\.[A-Z]{2}\.json$/, decode: decodeHomeResponse, maxBytes: 150 * KB},
  {pattern: /^discover\.(movie|tv)\.json$/, decode: decodeDiscoverResponse, maxBytes: 60 * KB},
  {pattern: /^people\.popular\.json$/, decode: (body) => decodePaged(body, 'people', decodePersonSummary), maxBytes: 200 * KB},
  {pattern: /^search\.json$/, decode: decodeSearchResponse, maxBytes: 60 * KB},
  {pattern: /^title\.(movie|tv)\.\d+\.json$/, decode: decodeTitleResponse, maxBytes: 80 * KB},
  {pattern: /^season\.tv\.\d+\.\d+\.json$/, decode: decodeSeasonResponse, maxBytes: 300 * KB},
  {pattern: /^person\.\d+\.json$/, decode: decodePersonResponse, maxBytes: 200 * KB},
  {pattern: /^genres\.json$/, decode: decodeGenresResponse, maxBytes: 8 * KB},
  {pattern: /^regions\.json$/, decode: decodeRegionsResponse, maxBytes: 20 * KB},
  {pattern: /^providers\.[A-Z]{2}\.json$/, decode: decodeProvidersResponse, maxBytes: 80 * KB},
  {pattern: /^availability\.[A-Z]{2}\.json$/, decode: decodeAvailabilityResponse, maxBytes: 200 * KB},
  {pattern: /^find\.json$/, decode: records(decodeFindResponse), maxBytes: 4 * KB},
  {pattern: /^legacyMovie\.json$/, decode: records(decodeLegacyMovieResponse), maxBytes: 4 * KB},
];

function fixtureFiles(): string[] {
  return readdirSync(FIXTURES).filter((name) => name.endsWith('.json')).sort();
}

function text(name: string): string {
  return readFileSync(join(FIXTURES, name), 'utf8');
}

function json(name: string): any {
  return JSON.parse(text(name));
}

test('the fixture folder holds exactly the F0.7 fixtures', () => {
  assert.deepEqual(fixtureFiles(), [...EXPECTED].sort());
  assert.deepEqual(readdirSync(FIXTURES).filter((name) => !name.endsWith('.json')), []);
});

test('every fixture decodes with the client decoders without dropping anything', () => {
  for (const name of fixtureFiles()) {
    const rule = RULES.find((candidate) => candidate.pattern.test(name));
    assert.ok(rule, `${name} has no decoder`);
    const data = json(name);
    assert.deepStrictEqual(rule.decode(data), data, `${name} lost data while decoding`);
  }
});

test('the comparison fails when a decoder drops an item', () => {
  const home = json('home.IN.json');
  home.rails[0].items[0].key = 'movie:0';
  assert.notDeepStrictEqual(decodeHomeResponse(home), home);
  const title = json('title.movie.603.json');
  title.title.cast[0].personKey = 'person:x';
  assert.notDeepStrictEqual(decodeTitleResponse(title), title);
});

test('every fixture fits the response size cap of its endpoint', () => {
  for (const name of fixtureFiles()) {
    const rule = RULES.find((candidate) => candidate.pattern.test(name));
    assert.ok(rule);
    const bytes = Buffer.byteLength(JSON.stringify(json(name)));
    assert.ok(bytes <= rule.maxBytes, `${name} is ${bytes} bytes, over ${rule.maxBytes}`);
  }
});

test('fixture names match their content', () => {
  for (const name of fixtureFiles()) {
    const region = /^(?:home|providers|availability)\.([A-Z]{2})\.json$/.exec(name);
    if (region) assert.equal(json(name).region, region[1], name);
    const title = /^title\.(movie|tv)\.(\d+)\.json$/.exec(name);
    if (title) assert.equal(json(name).title.key, `${title[1]}:${title[2]}`, name);
    const season = /^season\.tv\.(\d+)\.(\d+)\.json$/.exec(name);
    if (season) {
      assert.equal(json(name).season.key, `tv:${season[1]}`, name);
      assert.equal(json(name).season.seasonNumber, Number(season[2]), name);
    }
    const person = /^person\.(\d+)\.json$/.exec(name);
    if (person) assert.equal(json(name).person.key, `person:${person[1]}`, name);
    const discover = /^discover\.(movie|tv)\.json$/.exec(name);
    if (discover) assert.ok(json(name).results.every((item: {type: string}) => item.type === discover[1]), name);
  }
});

test('search holds 12 movies, 6 TV shows and 4 people, including every detail fixture', () => {
  const results: {kind: string; title?: {key: string; type: string}; person?: {key: string}}[] = json('search.json').results;
  assert.equal(results.filter((result) => result.kind === 'title' && result.title?.type === 'movie').length, 12);
  assert.equal(results.filter((result) => result.kind === 'title' && result.title?.type === 'tv').length, 6);
  assert.equal(results.filter((result) => result.kind === 'person').length, 4);
  const keys = results.map((result) => result.title?.key ?? result.person?.key);
  for (const key of ['movie:603', 'movie:299536', 'tv:1399', 'person:6384']) assert.ok(keys.includes(key), key);
});

test('the mapping fixtures resolve the documented ids', () => {
  const find = json('find.json');
  assert.deepEqual(Object.keys(find).sort(), ['tt0133093', 'tt0944947']);
  assert.equal(find.tt0133093.match.key, 'movie:603');
  assert.equal(find.tt0944947.match.key, 'tv:1399');
  const legacy = json('legacyMovie.json');
  assert.deepEqual(Object.keys(legacy), ['8462']);
  assert.equal(legacy['8462'].match.key, 'movie:299536');
  assert.equal(legacy['8462'].path, titleHref('movie:299536', legacy['8462'].match.slug));
});

test('every title fixture has availability for both fixture regions', () => {
  for (const region of ['IN', 'US']) {
    const items = json(`availability.${region}.json`).items;
    for (const key of ['movie:603', 'movie:299536', 'tv:1399']) assert.ok(items[key], `${key} in ${region}`);
  }
});

test('fixtures carry no banned strings, upstream hosts or credentials', () => {
  const extra = [/infohash/i, /free movies/i, /watch movies/i, /watch now/i, /api\.themoviedb\.org/i, /api_key/i, /\b[0-9a-f]{32}\b/i];
  for (const name of fixtureFiles()) {
    const body = text(name);
    assert.deepEqual(policy.bannedMatches(body), [], name);
    for (const pattern of extra) assert.doesNotMatch(body, pattern, name);
  }
});
