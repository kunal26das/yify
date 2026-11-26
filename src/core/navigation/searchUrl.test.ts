import assert from 'node:assert/strict';
import {test} from 'node:test';
import type {SearchUrlState} from '@/core/domain/search';
import {DEFAULT_SEARCH_URL_STATE, searchPath} from '@/core/domain/search';
import {normalizeSearchUrlState, SEARCH_URL_KEYS, searchUrlCodec} from './searchUrl';

const BROWSE: SearchUrlState = {
  q: '',
  type: 'tv',
  genres: [18, 80],
  providers: [8, 119],
  monetization: ['stream', 'free'],
  sort: 'rating',
  yearFrom: 1990,
  yearTo: 1999,
  ratingMin: 7.5,
  language: 'en',
};

test('the codec owns exactly the ten /search params', () => {
  assert.deepEqual([...searchUrlCodec.keys], ['q', 'type', 'genres', 'providers', 'monetization', 'sort', 'year_from', 'year_to', 'rating_min', 'lang']);
  assert.equal(searchUrlCodec.keys, SEARCH_URL_KEYS);
});

test('empty and unknown params parse to the defaults', () => {
  assert.deepEqual(searchUrlCodec.parse({}), DEFAULT_SEARCH_URL_STATE);
  assert.deepEqual(searchUrlCodec.parse({page: '2', query: 'dune', genre: 'action'}), DEFAULT_SEARCH_URL_STATE);
});

test('valid params parse to their state', () => {
  assert.deepEqual(searchUrlCodec.parse({
    q: 'dune', type: 'tv', genres: '18,80', providers: '8,119', monetization: 'stream,free', sort: 'rating',
    year_from: '1990', year_to: '1999', rating_min: '7.5', lang: 'en',
  }), {...BROWSE, q: 'dune'});
});

test('invalid values parse to defaults and parse never throws', () => {
  const cases: [Record<string, string>, Partial<SearchUrlState>][] = [
    [{type: 'anime'}, {type: 'all'}],
    [{type: 'MOVIE'}, {type: 'all'}],
    [{sort: 'seeds'}, {sort: 'popular'}],
    [{sort: 'toString'}, {sort: 'popular'}],
    [{genres: 'abc'}, {genres: []}],
    [{genres: '28,abc,0,1234567,28,12'}, {genres: [28, 12]}],
    [{providers: '8;9'}, {providers: []}],
    [{monetization: 'stream,cinema,stream,ads'}, {monetization: ['stream', 'ads']}],
    [{year_from: '1899'}, {yearFrom: null}],
    [{year_from: '2200'}, {yearFrom: null}],
    [{year_to: '99'}, {yearTo: null}],
    [{year_from: '2010', year_to: '2000'}, {yearFrom: null, yearTo: null}],
    [{rating_min: '7.3'}, {ratingMin: null}],
    [{rating_min: '0'}, {ratingMin: null}],
    [{rating_min: '11'}, {ratingMin: null}],
    [{rating_min: '0.5'}, {ratingMin: 0.5}],
    [{rating_min: '10'}, {ratingMin: 10}],
    [{lang: 'EN'}, {language: null}],
    [{lang: 'eng'}, {language: null}],
  ];
  for (const [params, expected] of cases) {
    assert.deepEqual(searchUrlCodec.parse(params), {...DEFAULT_SEARCH_URL_STATE, ...expected}, JSON.stringify(params));
  }
  assert.doesNotThrow(() => searchUrlCodec.parse({q: '%E0%A4%A', type: undefined, sort: null as unknown as string}));
});

test('lists are capped and repeated params are tolerated', () => {
  const parsed = searchUrlCodec.parse({
    genres: ['1,2,3', '4,5,6'],
    providers: Array.from({length: 25}, (_, index) => String(index + 1)).join(','),
    q: ['first', 'second'],
    type: ['movie', 'tv'],
  });
  assert.deepEqual(parsed.genres, [1, 2, 3, 4, 5]);
  assert.equal(parsed.providers.length, 20);
  assert.equal(parsed.q, 'first');
  assert.equal(parsed.type, 'movie');
});

test('queries keep their spacing but lose control characters, broken surrogates and anything past 100 characters', () => {
  assert.equal(searchUrlCodec.parse({q: '  dune part two '}).q, '  dune part two ');
  assert.equal(searchUrlCodec.parse({q: 'du\u0000ne\u007f\n'}).q, 'dune');
  assert.equal(searchUrlCodec.parse({q: 'a\uD800b\uDC00c'}).q, 'abc');
  const long = searchUrlCodec.parse({q: `${'a'.repeat(99)}\u{1F600}tail`}).q;
  assert.equal(long, `${'a'.repeat(99)}\u{1F600}`);
  assert.doesNotThrow(() => searchUrlCodec.serialize({...DEFAULT_SEARCH_URL_STATE, q: `x\uD800`}));
});

test('serialize writes every codec key and leaves defaults undefined', () => {
  const serialized = searchUrlCodec.serialize(DEFAULT_SEARCH_URL_STATE);
  assert.deepEqual(Object.keys(serialized), [...SEARCH_URL_KEYS]);
  assert.ok(Object.values(serialized).every((value) => value === undefined));
  assert.deepEqual(searchUrlCodec.serialize({...BROWSE, q: 'the matrix & co'}), {
    q: 'the matrix & co', type: 'tv', genres: '18,80', providers: '8,119', monetization: 'stream,free', sort: 'rating',
    year_from: '1990', year_to: '1999', rating_min: '7.5', lang: 'en',
  });
});

test('serialize uses the one domain serializer for /search', () => {
  for (const state of [DEFAULT_SEARCH_URL_STATE, BROWSE, {...DEFAULT_SEARCH_URL_STATE, q: 'amélie, 100% / ? #1', type: 'person' as const}]) {
    const serialized = searchUrlCodec.serialize(state);
    const query = Object.entries(serialized)
      .filter((entry): entry is [string, string] => entry[1] !== undefined)
      .map(([key, value]) => `${key}=${encodeURIComponent(value).replace(/%2C/gi, ',')}`)
      .join('&');
    assert.equal(query ? `/search?${query}` : '/search', searchPath(state));
  }
});

test('parse and serialize round-trip every normalized state', () => {
  const states: SearchUrlState[] = [
    DEFAULT_SEARCH_URL_STATE,
    BROWSE,
    {...DEFAULT_SEARCH_URL_STATE, q: 'Ψ & ✓, 50% off?', type: 'person'},
    {...DEFAULT_SEARCH_URL_STATE, type: 'movie', yearTo: 1979, ratingMin: 8},
  ];
  for (const state of states) {
    const params = Object.fromEntries(Object.entries(searchUrlCodec.serialize(state)).filter(([, value]) => value !== undefined));
    assert.deepEqual(searchUrlCodec.parse(params), state, JSON.stringify(state));
  }
});

test('serialize normalizes a state before writing it', () => {
  assert.deepEqual(searchUrlCodec.serialize({
    ...DEFAULT_SEARCH_URL_STATE, genres: [28, 28, -1], yearFrom: 2020, yearTo: 2010, ratingMin: 7.3, language: 'EN',
  }), {...searchUrlCodec.serialize(DEFAULT_SEARCH_URL_STATE), genres: '28'});
  assert.deepEqual(normalizeSearchUrlState({q: 'dune'}), {...DEFAULT_SEARCH_URL_STATE, q: 'dune'});
  assert.deepEqual(normalizeSearchUrlState({type: 'shows', genres: 'drama', monetization: ['rent', 'rent']}), {...DEFAULT_SEARCH_URL_STATE, monetization: ['rent']});
});
