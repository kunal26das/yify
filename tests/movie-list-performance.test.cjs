const assert = require('node:assert/strict');
const {test} = require('node:test');
const React = require('react');
const {act, create} = require('react-test-renderer');
const {loadTypeScript} = require('./helpers/load-typescript.cjs');

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const {createHomeShelfSelector} = loadTypeScript('presentation/movies/homeShelfSelection.ts');
const {createPosterPrefetcher, posterPrefetchUrls} = loadTypeScript('presentation/movies/posterPrefetch.ts');
const {TopTenProvider, useTopTenRank} = loadTypeScript('presentation/movies/components/TopTenContext.tsx');
const flush = () => new Promise(setImmediate);
const movies = (start, count) => Array.from({length: count}, (_, i) => ({id: start + i}));
const shelf = (key, items, options = {}) => ({
    key, title: key, variant: 'standard', limit: 20, query: {},
    movies: items, status: 'loaded', page: 1, hasMore: true, ...options,
});

test('a full rail examines only20 of50 unique candidates and preserves the same displayed movies', () => {
    let inspected = new Set();
    const items = Array.from({length: 50}, (_, index) => ({get id() { inspected.add(index); return index; }}));
    const selected = createHomeShelfSelector()([shelf('full', items)], []);
    assert.equal(inspected.size, 20);
    inspected = new Set();
    const previous = items.filter((movie) => !new Set().has(movie.id)).slice(0, 20);
    assert.equal(inspected.size, 50);
    assert.deepEqual(selected.shelves[0].movies, previous);
});

test('updating one home shelf retains every unaffected shelf and movie-array identity', () => {
    const select = createHomeShelfSelector();
    const sources = Array.from({length: 30}, (_, i) => shelf(`rail-${i}`, movies(i * 50, 50)));
    const before = select(sources, []);
    const changed = sources.map((item, i) => i === 20 ? {...item, title: 'Updated title'} : item);
    const after = select(changed, []);
    const replaced = after.shelves.filter((item, i) => item !== before.shelves[i]);
    assert.equal(replaced.length, 1);
    assert.equal(replaced[0].title, 'Updated title');
    assert.equal(after.shelves.filter((item, i) => item.movies !== before.shelves[i].movies).length, 1);
});

test('hero and earlier-rail exclusions still scan far enough to fill later shelves', () => {
    const select = createHomeShelfSelector();
    const selected = select([
        shelf('first', movies(0, 50)),
        shelf('second', movies(0, 50)),
    ], movies(0, 5));
    assert.deepEqual(selected.shelves[0].movies.map((m) => m.id), movies(5, 20).map((m) => m.id));
    assert.deepEqual(selected.shelves[1].movies.map((m) => m.id), movies(25, 20).map((m) => m.id));
});

test('changed hero exclusions invalidate affected rails instead of returning stale cached movies', () => {
    const select = createHomeShelfSelector();
    const source = [shelf('first', movies(0, 30))];
    const before = select(source, []);
    const after = select(source, [{id: 0}]);
    assert.notEqual(after.shelves[0], before.shelves[0]);
    assert.equal(after.shelves[0].movies[0].id, 1);
});

test('thin shelves keep pagination and ordered reveal behavior, stopping at the page limit', () => {
    const select = createHomeShelfSelector();
    const result = select([
        shelf('thin', movies(0, 3)),
        shelf('waiting', movies(100, 20)),
    ], []);
    assert.deepEqual(result.needsMore, [{key: 'thin', next: 2}]);
    assert.deepEqual(result.shelves.map((item) => item.status), ['loading', 'loading']);
    const exhausted = select([
        shelf('thin', movies(0, 3), {page: 5}),
        shelf('waiting', movies(100, 20)),
    ], []);
    assert.deepEqual(exhausted.needsMore, []);
    assert.deepEqual(exhausted.shelves.map((item) => item.status), ['loaded', 'loaded']);
});

test('unchanged top-ten arrays prevent context-driven card renders during sibling shelf updates', async (t) => {
    const select = createHomeShelfSelector();
    const first = shelf('top-10', movies(1, 10), {limit: 10});
    const sibling = shelf('other', movies(100, 50));
    const initial = select([first, sibling], []);
    let renders = 0;
    let rank;
    const Card = React.memo(function Card() {
        renders++;
        rank = useTopTenRank(1);
        return null;
    });
    const card = React.createElement(Card);
    let renderer;
    await act(async () => { renderer = create(React.createElement(TopTenProvider, {movies: initial.shelves[0].movies}, card)); });
    t.after(async () => { await act(async () => { renderer.unmount(); }); });
    for (let i = 0; i < 10; i++) {
        const next = select([first, {...sibling, page: i + 1}], []);
        await act(async () => { renderer.update(React.createElement(TopTenProvider, {movies: next.shelves[0].movies}, card)); });
    }
    assert.equal(renders, 1, 'ten unrelated shelf updates cause zero additional rank-consumer renders');
    assert.equal(rank, 1);
    const changed = select([{...first, movies: [...first.movies].reverse()}, sibling], []);
    await act(async () => { renderer.update(React.createElement(TopTenProvider, {movies: changed.shelves[0].movies}, card)); });
    assert.equal(renders, 2);
    assert.equal(rank, 10, 'a real ranking change still renders the new badge');
});

test('a100-movie phone batch prefetches just the next4 posters rather than all100', () => {
    let examined = 0;
    const urls = posterPrefetchUrls(movies(0, 100), 5, 2, (movie) => { examined++; return `poster-${movie.id}`; });
    assert.deepEqual(urls, ['poster-6', 'poster-7', 'poster-8', 'poster-9']);
    assert.equal(examined, 4);
    assert.equal(posterPrefetchUrls(movies(0, 100), 5, 12, (movie) => `poster-${movie.id}`).length, 12);
});

test('prefetch drops stale queued windows and starts at most one batch at a time', async () => {
    const calls = [];
    const complete = [];
    const prefetcher = createPosterPrefetcher((urls) => {
        calls.push(urls);
        return new Promise((resolve) => complete.push(resolve));
    });
    prefetcher.request(['a', 'b', 'c', 'd']);
    await flush();
    prefetcher.request(['stale-1', 'stale-2']);
    prefetcher.request(['c', 'd', 'current-1', 'current-2']);
    assert.equal(calls.length, 1);
    complete[0](true);
    await flush();
    assert.deepEqual(calls, [['a', 'b', 'c', 'd'], ['current-1', 'current-2']]);
    complete[1](true);
    await flush();
    prefetcher.dispose();
});

test('prefetch reuses successful requests but retries failed images on a later viewport update', async () => {
    let calls = 0;
    const prefetcher = createPosterPrefetcher(async () => { calls++; return calls > 1; });
    prefetcher.request(['a']);
    await flush();
    prefetcher.request(['a']);
    await flush();
    prefetcher.request(['a']);
    await flush();
    assert.equal(calls, 2);
    prefetcher.dispose();
});

test('prefetch handles rejection without an unhandled promise and stops scheduling after unmount', async () => {
    let calls = 0;
    let finish;
    const prefetcher = createPosterPrefetcher(() => {
        calls++;
        return new Promise((_resolve, reject) => { finish = reject; });
    });
    prefetcher.request(['a']);
    await flush();
    prefetcher.request(['b']);
    prefetcher.dispose();
    finish(new Error('offline'));
    await flush();
    prefetcher.request(['c']);
    await flush();
    assert.equal(calls, 1);
});

test('same-length search replacements and larger poster rungs are still prefetched', async () => {
    const calls = [];
    const prefetcher = createPosterPrefetcher(async (urls) => { calls.push(urls); return true; });
    prefetcher.request(posterPrefetchUrls(movies(0, 100), 0, 2, (movie) => `small-${movie.id}`));
    await flush();
    prefetcher.request(posterPrefetchUrls(movies(1000, 100), 0, 2, (movie) => `small-${movie.id}`));
    await flush();
    prefetcher.request(posterPrefetchUrls(movies(1000, 100), 0, 2, (movie) => `large-${movie.id}`));
    await flush();
    assert.equal(calls.length, 3);
    assert.equal(calls[1][0], 'small-1001');
    assert.equal(calls[2][0], 'large-1001');
    prefetcher.dispose();
});
