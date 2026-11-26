const assert = require('node:assert/strict');
const {afterEach, test} = require('node:test');
const {QueryClient} = require('@tanstack/react-query');
const {loadTs} = require('../../../tests/helpers/loadTs.cjs');

const originalFetch = globalThis.fetch;

function memoryKv() {
  const data = new Map();
  return {
    data,
    getItemSync: (key) => (data.has(key) ? data.get(key) : null),
    setItemSync: (key, value) => {
      data.set(key, value);
    },
    removeItemSync: (key) => data.delete(key),
    getAllKeysSync: () => [...data.keys()],
  };
}

function load() {
  const store = memoryKv();
  const options = loadTs('src/core/query/options.ts', {'expo-sqlite/kv-store': {__esModule: true, default: store}});
  return {store, options};
}

function home(region) {
  return {v: 2, region, generatedAt: '2026-11-26T10:00:00.000Z', hero: [], rails: []};
}

function serve(handler) {
  const calls = [];
  globalThis.fetch = async (input) => {
    const url = new URL(String(input));
    calls.push(url);
    return Response.json(handler(url));
  };
  return calls;
}

afterEach(() => {
  globalThis.fetch = originalFetch;
});

test('the stale and garbage-collection times follow the A4.3 table', () => {
  const {options} = load();
  const minute = 60_000;
  assert.deepEqual(options.QUERY_TIMES.home, {staleTime: 15 * minute, gcTime: 24 * 60 * minute});
  assert.deepEqual(options.QUERY_TIMES.title, {staleTime: 30 * minute, gcTime: 60 * minute});
  assert.deepEqual(options.QUERY_TIMES.genres, {staleTime: 24 * 60 * minute, gcTime: Infinity});
  assert.deepEqual(options.QUERY_TIMES.find, {staleTime: Infinity, gcTime: 24 * 60 * minute});
  assert.deepEqual(options.QUERY_TIMES.geo, {staleTime: 7 * 24 * 60 * minute, gcTime: Infinity});
  assert.deepEqual(options.titleQueryOptions('movie:603', 'IN').queryKey, ['v2', 'title', 'movie:603', 'IN']);
});

test('a successful home fetch saves a snapshot that later seeds the query, keeping two regions', async () => {
  const {store, options} = load();
  serve((url) => home(url.searchParams.get('region')));
  const client = new QueryClient();
  assert.equal(options.homeQueryOptions('IN').initialData(), undefined);
  await client.fetchQuery(options.homeQueryOptions('IN'));
  const saved = options.readHomeSnapshot('IN');
  assert.equal(saved.data.region, 'IN');
  assert.equal(options.homeQueryOptions('IN').initialDataUpdatedAt(), saved.savedAt);
  assert.deepEqual(options.homeQueryOptions('IN').initialData(), home('IN'));
  options.writeHomeSnapshot(home('US'), saved.savedAt + 1);
  options.writeHomeSnapshot(home('GB'), saved.savedAt + 2);
  assert.deepEqual([...store.data.keys()].filter((key) => key.startsWith('v2.cache.home.')).sort(), ['v2.cache.home.GB', 'v2.cache.home.US']);
  store.data.set('v2.cache.home.US', JSON.stringify({v: 1, d: {savedAt: 1, data: {...home('US'), hero: {}}}}));
  assert.equal(options.readHomeSnapshot('US'), null);
  store.data.set('v2.cache.home.FR', JSON.stringify({v: 1, d: {savedAt: 1, data: home('DE')}}));
  assert.equal(options.readHomeSnapshot('FR'), null);
  client.clear();
});

test('genres and regions share one reference snapshot that never looks fresher than its older list', async () => {
  const {store, options} = load();
  const calls = serve((url) => (url.pathname.endsWith('/genres')
    ? {v: 2, genres: [{id: 28, name: 'Action', types: ['movie']}]}
    : {v: 2, regions: [{code: 'IN', name: 'India'}]}));
  const seed = (snapshot) => store.data.set('v2.cache.reference', JSON.stringify({v: 1, d: snapshot}));
  const action = [{id: 28, name: 'Action', types: ['movie']}];
  const started = Date.now();
  assert.equal(options.genresQueryOptions().initialData(), undefined);
  await new QueryClient().fetchQuery(options.genresQueryOptions());
  assert.ok(options.readReferenceSnapshot().savedAt >= started);
  seed({savedAt: 1_000, genres: [{id: 12, name: 'Adventure', types: ['movie']}], regions: []});
  await new QueryClient().fetchQuery(options.genresQueryOptions());
  assert.ok(options.readReferenceSnapshot().savedAt >= started);
  seed({savedAt: 1_000, genres: [], regions: [{code: 'GB', name: 'United Kingdom'}]});
  await new QueryClient().fetchQuery(options.genresQueryOptions());
  assert.deepEqual(options.readReferenceSnapshot(), {savedAt: 1_000, genres: action, regions: [{code: 'GB', name: 'United Kingdom'}]});
  assert.equal(options.regionsQueryOptions().initialDataUpdatedAt(), 1_000);
  const client = new QueryClient();
  assert.deepEqual(await client.fetchQuery(options.regionsQueryOptions()), [{code: 'IN', name: 'India'}]);
  assert.deepEqual(calls.map((url) => url.pathname), ['/api/v2/genres', '/api/v2/genres', '/api/v2/genres', '/api/v2/regions']);
  assert.deepEqual(options.readReferenceSnapshot(), {savedAt: 1_000, genres: action, regions: [{code: 'IN', name: 'India'}]});
  assert.deepEqual(options.regionsQueryOptions().initialData(), [{code: 'IN', name: 'India'}]);
  seed({savedAt: Date.now() + 86_400_000, genres: [], regions: [{code: 'IN', name: 'India'}]});
  await new QueryClient().fetchQuery(options.genresQueryOptions());
  assert.ok(options.readReferenceSnapshot().savedAt <= Date.now());
  client.clear();
});

test('search waits for two characters and both infinite queries page until the last page', () => {
  const {options} = load();
  assert.equal(options.searchQueryOptions(' d ', 'all').enabled, false);
  const search = options.searchQueryOptions('  DUNE ', 'movie');
  assert.equal(search.enabled, true);
  assert.deepEqual(search.queryKey, ['v2', 'search', 'movie', 'dune']);
  assert.equal(search.getNextPageParam({page: 1, totalPages: 3}), 2);
  assert.equal(search.getNextPageParam({page: 3, totalPages: 3}), undefined);
  const discover = options.discoverQueryOptions({type: 'movie', genres: [], providers: [], monetization: [], region: null, sort: 'popular', yearFrom: null, yearTo: null, ratingMin: null, language: null});
  assert.equal(discover.initialPageParam, 1);
  assert.equal(discover.getNextPageParam({page: 500, totalPages: 500}), undefined);
});
