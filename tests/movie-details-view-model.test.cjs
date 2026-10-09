const assert = require('node:assert/strict');
const {test} = require('node:test');
const React = require('react');
const {act, create} = require('react-test-renderer');
const {loadTypeScript} = require('./helpers/load-typescript.cjs');

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const {useMovieDetailsViewModel} = loadTypeScript('presentation/movies/useMovieDetailsViewModel.ts', {
    '../hooks/use-reload-on-catalog-access': {useReloadOnCatalogAccess: () => {}},
});

function deferred() {
    let resolve;
    let reject;
    const promise = new Promise((done, fail) => {resolve = done; reject = fail;});
    return {promise, resolve, reject};
}

async function mount(t, repository, movieId) {
    let current;
    let renderer;
    const states = [];
    function Hook({id, source}) {
        current = useMovieDetailsViewModel(source, id);
        states.push({id, details: current.details, suggestions: current.suggestions, loading: current.loading, error: current.error});
        return null;
    }
    await act(async () => {renderer = create(React.createElement(Hook, {id: movieId, source: repository}));});
    t.after(async () => {await act(async () => renderer.unmount());});
    return {
        get value() {return current;}, states,
        update: async id => {movieId = id; await act(async () => renderer.update(React.createElement(Hook, {id, source: repository})));},
        replace: async source => {repository = source; await act(async () => renderer.update(React.createElement(Hook, {id: movieId, source})));},
        run: async action => {await act(async () => action(current));},
    };
}

test('changing movie ID clears old details and suggestions while loading the new movie', async t => {
    const nextDetails = deferred();
    const nextSuggestions = deferred();
    const requests = [];
    const hook = await mount(t, {
        getMovieDetails(id) {requests.push(['details', id]); return id === 1 ? Promise.resolve({id: 1, title: 'Old'}) : nextDetails.promise;},
        getMovieSuggestions(id) {requests.push(['suggestions', id]); return id === 1 ? Promise.resolve([{id: 11}]) : nextSuggestions.promise;},
    }, 1);
    assert.equal(hook.value.details.id, 1);
    assert.deepEqual(hook.value.suggestions.map(movie => movie.id), [11]);
    assert.equal(hook.value.loading, false);

    const previousRenderCount = hook.states.length;
    await hook.update(2);
    assert.deepEqual(requests, [['details', 1], ['suggestions', 1], ['details', 2], ['suggestions', 2]]);
    assert.equal(hook.value.details, null);
    assert.deepEqual(hook.value.suggestions, []);
    assert.equal(hook.value.loading, true);
    assert.ok(hook.states.slice(previousRenderCount).every(state => state.details === null &&
        state.suggestions.length === 0 && state.loading && state.error === null));

    await hook.run(() => nextDetails.resolve({id: 2, title: 'New'}));
    await hook.run(() => nextSuggestions.resolve([{id: 22}]));
    assert.equal(hook.value.details.id, 2);
    assert.deepEqual(hook.value.suggestions.map(movie => movie.id), [22]);
    assert.equal(hook.value.loading, false);
});

test('a new movie clears the previous error and ignores superseded responses', async t => {
    const oldDetails = deferred();
    const oldSuggestions = deferred();
    const nextDetails = deferred();
    const nextSuggestions = deferred();
    const hook = await mount(t, {
        getMovieDetails(id) {return id === 1 ? oldDetails.promise : nextDetails.promise;},
        getMovieSuggestions(id) {return id === 1 ? oldSuggestions.promise : nextSuggestions.promise;},
    }, 1);
    await hook.update(2);
    await hook.run(() => oldDetails.reject(new Error('Old failure')));
    await hook.run(() => oldSuggestions.resolve([{id: 11}]));
    assert.equal(hook.value.error, null);
    assert.equal(hook.value.details, null);
    assert.deepEqual(hook.value.suggestions, []);
    assert.equal(hook.value.loading, true);
    await hook.run(() => nextDetails.resolve({id: 2}));
    await hook.run(() => nextSuggestions.resolve([{id: 22}]));
    assert.equal(hook.value.details.id, 2);
    assert.deepEqual(hook.value.suggestions.map(movie => movie.id), [22]);
    assert.equal(hook.value.loading, false);
});

test('changing movie ID resets a failed load before retrying the new movie', async t => {
    const nextDetails = deferred();
    const hook = await mount(t, {
        getMovieDetails(id) {return id === 1 ? Promise.reject(new Error('Unavailable')) : nextDetails.promise;},
        getMovieSuggestions() {return Promise.resolve([]);},
    }, 1);
    assert.equal(hook.value.error, 'Unavailable');
    assert.equal(hook.value.loading, false);
    await hook.update(2);
    assert.equal(hook.value.error, null);
    assert.equal(hook.value.loading, true);
    await hook.run(() => nextDetails.resolve({id: 2}));
    assert.equal(hook.value.error, null);
    assert.equal(hook.value.details.id, 2);
});

test('refreshing the same movie retains its details until the replacement arrives', async t => {
    const refreshed = deferred();
    let calls = 0;
    const hook = await mount(t, {
        getMovieDetails() {return ++calls === 1 ? Promise.resolve({id: 1, title: 'Original'}) : refreshed.promise;},
        getMovieSuggestions() {return Promise.resolve([]);},
    }, 1);
    await hook.run(model => model.refresh());
    assert.equal(hook.value.details.title, 'Original');
    assert.equal(hook.value.refreshing, true);
    assert.equal(hook.value.loading, false);
    await hook.run(() => refreshed.resolve({id: 1, title: 'Updated'}));
    assert.equal(hook.value.details.title, 'Updated');
    assert.equal(hook.value.refreshing, false);
});

test('replacing the repository for the same movie does not retain the previous source', async t => {
    const replacement = deferred();
    const hook = await mount(t, {
        getMovieDetails() {return Promise.resolve({id: 1, title: 'Previous source'});},
        getMovieSuggestions() {return Promise.resolve([{id: 11}]);},
    }, 1);
    await hook.replace({
        getMovieDetails() {return replacement.promise;},
        getMovieSuggestions() {return Promise.resolve([]);},
    });
    assert.equal(hook.value.details, null);
    assert.deepEqual(hook.value.suggestions, []);
    assert.equal(hook.value.loading, true);
    await hook.run(() => replacement.resolve({id: 1, title: 'New source'}));
    assert.equal(hook.value.details.title, 'New source');
    assert.equal(hook.value.loading, false);
});
