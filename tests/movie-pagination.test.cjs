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
    function Hook() {
        current = useMoviesViewModel(repository);
        return null;
    }
    await act(async () => { renderer = create(React.createElement(Hook)); });
    t.after(async () => { await act(async () => { renderer.unmount(); }); });
    return {
        get value() { return current; },
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
