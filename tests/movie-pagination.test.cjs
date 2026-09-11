const assert = require('node:assert/strict');
const {test} = require('node:test');
const React = require('react');
const {act, create} = require('react-test-renderer');
const {loadTypeScript} = require('./helpers/load-typescript.cjs');

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const {useMoviesViewModel} = loadTypeScript('presentation/movies/useMoviesViewModel.ts');

async function mount(repository, t) {
    let current;
    let renderer;
    const snapshots = [];
    function Hook() {
        current = useMoviesViewModel(repository);
        snapshots.push({ids: current.movies.map(movie => movie.id), count: current.totalMovieCount, error: current.error});
        return null;
    }
    await act(async () => { renderer = create(React.createElement(Hook)); });
    t.after(async () => { await act(async () => { renderer.unmount(); }); });
    return {
        get value() { return current; },
        snapshots,
        run: async (action) => { await act(async () => { action(current); }); },
    };
}

function repositoryFixture({initialHasMore = true} = {}) {
    const requests = [];
    let failure = () => false;
    return {
        requests,
        failWhen(predicate) { failure = predicate; },
        listMovies: async (params) => {
            const label = params.query || params.genre || 'all';
            requests.push({label, page: params.page});
            if (failure(params)) throw new Error('temporary network failure');
            return {
                movies: [{id: (label === 'all' ? 0 : 1000) + params.page, title: `${label}:${params.page}`}],
                movieCount: 1000,
                hasMore: label === 'all' ? initialHasMore : true,
            };
        },
    };
}

test('retrying a failed search replaces old results starting at page one', async (t) => {
    const repository = repositoryFixture();
    const hook = await mount(repository, t);
    await hook.run((model) => model.loadInitial());
    await hook.run((model) => model.loadMore());
    repository.failWhen((params) => params.query === 'Alien');
    await hook.run((model) => model.submitSearch('Alien'));
    assert.equal(hook.value.error, 'temporary network failure');

    repository.failWhen(() => false);
    await hook.run((model) => model.loadMore());
    assert.deepEqual(repository.requests.slice(-2), [{label: 'Alien', page: 1}, {label: 'Alien', page: 2}]);
    assert.deepEqual(hook.value.movies.map((movie) => movie.title), ['Alien:1', 'Alien:2']);
    assert.equal(hook.value.error, null);
});

function deferred() {
    let resolve;
    let reject;
    const promise = new Promise((done, fail) => {resolve = done; reject = fail;});
    return {promise, resolve, reject};
}

for (const previousFails of [false, true]) {
    test(`rapid filters and search preserve the latest combined intent while ignoring an old ${previousFails ? 'failure' : 'success'}`, async t => {
        const old = deferred();
        const latest = deferred();
        const requests = [];
        const repository = {listMovies: params => {
            requests.push(params);
            const result = (base, movieCount) => ({movies: [{id: base + params.page}], movieCount, hasMore: true});
            if (params.query === 'Alien') return latest.promise.then(() => result(100, 77));
            if (params.quality) return old.promise.then(() => result(50, 999));
            return Promise.resolve(result(0, 1000));
        }};
        const hook = await mount(repository, t);
        await hook.run(model => model.loadInitial());
        await hook.run(model => model.applyFilters({quality: '1080p'}));
        await hook.run(model => model.applyFilters({...model.filters, genre: 'action'}));
        await hook.run(model => model.submitSearch(' Alien '));
        await hook.run(model => model.applyFilters({...model.filters, minimum_rating: 7}));
        const expected = {quality: '1080p', genre: 'action', minimum_rating: 7};
        assert.deepEqual(hook.value.appliedFilters, expected);
        assert.equal(hook.value.appliedQuery, 'Alien');
        await hook.run(() => previousFails ? old.reject(new Error('superseded request failed')) : old.resolve());
        assert.deepEqual(hook.value.movies.map(movie => movie.id), [1, 2]);
        assert.equal(hook.value.totalMovieCount, 1000);
        assert.equal(hook.value.error, null);
        assert.equal(hook.value.loading, true);
        assert.equal(requests.length, 6);
        assert.deepEqual(requests.slice(-2).map(({page, limit, query, quality, genre, minimum_rating}) =>
            ({page, limit, query, quality, genre, minimum_rating})), [1, 2].map(page =>
            ({page, limit: 50, query: 'Alien', ...expected})));
        await hook.run(() => latest.resolve());
        assert.deepEqual(hook.value.movies.map(movie => movie.id), [101, 102]);
        assert.equal(hook.value.totalMovieCount, 77);
        assert.equal(hook.value.error, null);
        assert.ok(hook.snapshots.every(state => state.count !== 999 && state.error === null));
        assert.ok(hook.snapshots.every(state => !state.ids.some(id => id >= 50 && id < 100)));
    });
}

test('search keeps selected filters unless an explicit route filter set replaces them', async t => {
    const requests = [];
    const hook = await mount({listMovies: async params => {
        requests.push(params);
        return {movies: [{id: params.page}], movieCount: 2, hasMore: false};
    }}, t);
    await hook.run(model => model.applyFilters({genre: 'action', quality: '2160p'}));
    await hook.run(model => model.submitSearch('Alien'));
    assert.equal(requests.at(-1).genre, 'action');
    assert.equal(requests.at(-1).quality, '2160p');
    await hook.run(model => model.submitSearch('Arrival', {}));
    assert.equal(requests.at(-1).query, 'Arrival');
    assert.equal(requests.at(-1).genre, undefined);
    assert.equal(requests.at(-1).quality, undefined);
});

test('append removes duplicate movie IDs across both pages and earlier batches', async t => {
    const requests = [];
    const hook = await mount({listMovies: async params => {
        requests.push(params);
        return {movies: [params.page, params.page + 1].map(id => ({id})), movieCount: 5, hasMore: params.page < 4};
    }}, t);
    await hook.run(model => model.loadInitial());
    assert.deepEqual(hook.value.movies.map(movie => movie.id), [1, 2, 3]);
    await hook.run(model => model.loadMore());
    assert.deepEqual(hook.value.movies.map(movie => movie.id), [1, 2, 3, 4, 5]);
    assert.deepEqual(requests.map(({page, limit}) => ({page, limit})), [1, 2, 3, 4].map(page => ({page, limit: 50})));
    assert.equal(hook.value.totalMovieCount, 5);
    assert.equal(hook.value.hasMore, false);
});

test('refresh failure retains the loaded movies and their count until a replacement succeeds', async t => {
    const repository = repositoryFixture();
    const hook = await mount(repository, t);
    await hook.run(model => model.loadInitial());
    const previous = hook.value.movies;
    repository.failWhen(() => true);
    await hook.run(model => model.loadInitial());
    assert.equal(hook.value.movies, previous);
    assert.equal(hook.value.totalMovieCount, 1000);
    assert.equal(hook.value.error, 'temporary network failure');
    repository.failWhen(() => false);
    await hook.run(model => model.loadMore());
    assert.deepEqual(repository.requests.slice(-2), [{label: 'all', page: 1}, {label: 'all', page: 2}]);
    assert.equal(hook.value.error, null);
});

test('a failed filter can be retried even when the previous list was exhausted', async (t) => {
    const repository = repositoryFixture({initialHasMore: false});
    const hook = await mount(repository, t);
    await hook.run((model) => model.loadInitial());
    assert.equal(hook.value.hasMore, false);
    repository.failWhen((params) => params.genre === 'Horror');
    await hook.run((model) => model.applyFilters({genre: 'Horror'}));

    repository.failWhen(() => false);
    await hook.run((model) => model.loadMore());
    assert.deepEqual(hook.value.movies.map((movie) => movie.title), ['Horror:1', 'Horror:2']);
    await hook.run((model) => model.loadMore());
    assert.deepEqual(repository.requests.slice(-2), [{label: 'Horror', page: 3}, {label: 'Horror', page: 4}]);
});

test('retrying an append failure keeps loaded results and retries the missing batch', async (t) => {
    const repository = repositoryFixture();
    const hook = await mount(repository, t);
    await hook.run((model) => model.loadInitial());
    repository.failWhen((params) => params.page >= 3);
    await hook.run((model) => model.loadMore());
    assert.deepEqual(hook.value.movies.map((movie) => movie.title), ['all:1', 'all:2']);

    repository.failWhen(() => false);
    await hook.run((model) => model.loadMore());
    assert.deepEqual(repository.requests.slice(-2), [{label: 'all', page: 3}, {label: 'all', page: 4}]);
    assert.deepEqual(hook.value.movies.map((movie) => movie.title), ['all:1', 'all:2', 'all:3', 'all:4']);
});
