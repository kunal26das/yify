const assert = require('node:assert/strict');
const {test} = require('node:test');
const React = require('react');
const {act, create} = require('react-test-renderer');
const {loadTypeScript} = require('./helpers/load-typescript.cjs');

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const {useFeedViewModel} = loadTypeScript('presentation/movies/useFeedViewModel.ts');

function result(id, hasMore = false) {
    return {movies: [{id}], pageNumber: 1, movieCount: 100, hasMore};
}

function deferred() {
    let resolve;
    let reject;
    const promise = new Promise((done, fail) => {resolve = done; reject = fail;});
    return {promise, resolve, reject};
}

async function mount(t, repository, options = {}) {
    let current;
    let renderer;
    const states = [];
    function Hook({settings}) {
        current = useFeedViewModel(repository, settings);
        states.push({chip: current.chip, error: current.error});
        return null;
    }
    await act(async () => {renderer = create(React.createElement(Hook, {settings: options}));});
    t.after(async () => {await act(async () => renderer.unmount());});
    return {
        get value() {return current;}, states,
        run: async action => {await act(async () => action(current));},
        update: async settings => {await act(async () => renderer.update(React.createElement(Hook, {settings})));},
    };
}

test('compact Popular feed requests six titles and preserves its page size while paginating', async t => {
    const requests = [];
    const hook = await mount(t, {listMovies: async params => {requests.push(params); return result(params.page, true);}},
        {skipHero: true, pageSize: 6});
    await hook.run(model => model.loadInitial());
    await hook.run(model => model.loadInitial());
    assert.deepEqual(requests, [{page: 1, limit: 6, sort_by: 'download_count', order_by: 'desc'}]);
    await hook.run(model => model.loadMore());
    assert.deepEqual(requests.at(-1), {page: 2, limit: 6, sort_by: 'download_count', order_by: 'desc'});
    assert.deepEqual(hook.value.movies.map(movie => movie.id), [1, 2]);
});

test('Latest starts with its own request and mounted feed configuration remains stable on rerender', async t => {
    const requests = [];
    const hook = await mount(t, {listMovies: async params => {requests.push(params); return result(params.page, true);}},
        {skipHero: true, initialChip: 'new', pageSize: 6});
    assert.equal(hook.value.chip, 'new');
    await hook.run(model => model.loadInitial());
    assert.deepEqual(requests[0], {page: 1, limit: 6, sort_by: 'date_added', order_by: 'desc'});
    await hook.update({skipHero: true, initialChip: 'all', pageSize: 50});
    await hook.run(model => model.loadMore());
    assert.equal(hook.value.chip, 'new');
    assert.deepEqual(requests.at(-1), {page: 2, limit: 6, sort_by: 'date_added', order_by: 'desc'});
});

test('page size stays within the API bounds and invalid initial presets use the existing default', async t => {
    for (const [pageSize, limit] of [[undefined, 50], [0, 1], [-10, 1], [200, 50], [6.9, 6], [NaN, 50], [Infinity, 50]]) {
        const requests = [];
        const hook = await mount(t, {listMovies: async params => {requests.push(params); return result(1);}},
            {skipHero: true, initialChip: 'missing', pageSize});
        await hook.run(model => model.loadInitial());
        assert.equal(hook.value.chip, 'all');
        assert.equal(requests.length, 1);
        assert.equal(requests[0].limit, limit);
        assert.equal(requests[0].sort_by, 'download_count');
    }
});

test('rapid preset changes discard a failed old response and request only the last selected preset', async t => {
    const popular = deferred();
    const latest = deferred();
    const requests = [];
    const hook = await mount(t, {listMovies: params => {
        requests.push(params);
        return params.sort_by === 'download_count' ? popular.promise : latest.promise;
    }}, {skipHero: true});
    await hook.run(model => model.loadInitial());
    await hook.run(model => model.setChip('top-rated'));
    await hook.run(model => model.setChip('new'));
    await hook.run(() => popular.reject(new Error('old Popular request failed')));
    assert.equal(hook.value.chip, 'new');
    assert.equal(hook.value.error, null);
    assert.equal(hook.value.loading, true);
    assert.deepEqual(requests.map(request => request.sort_by), ['download_count', 'date_added']);
    assert.ok(hook.states.every(state => state.error === null));
    await hook.run(() => latest.resolve(result(2)));
    assert.deepEqual(hook.value.movies.map(movie => movie.id), [2]);
    assert.equal(hook.value.loading, false);
});

test('a failure for the selected preset stays visible and can be retried', async t => {
    let fail = true;
    const requests = [];
    const hook = await mount(t, {listMovies: async params => {
        requests.push(params);
        if (fail) throw new Error('Latest is unavailable');
        return result(3);
    }}, {skipHero: true, initialChip: 'new'});
    await hook.run(model => model.loadInitial());
    assert.equal(hook.value.error, 'Latest is unavailable');
    fail = false;
    await hook.run(model => model.reload());
    assert.equal(hook.value.error, null);
    assert.deepEqual(hook.value.movies.map(movie => movie.id), [3]);
    assert.deepEqual(requests.map(request => request.page), [1, 1]);
});
