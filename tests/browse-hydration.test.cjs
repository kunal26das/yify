const assert = require('node:assert/strict');
const {test} = require('node:test');
const React = require('react');
const {renderToString} = require('react-dom/server');
const {act, create} = require('react-test-renderer');
const {loadTypeScript} = require('./helpers/load-typescript.cjs');

const {DEFAULT_BROWSE_DEFAULTS} = loadTypeScript('domain/entities/Preferences.ts');
const {useMoviesViewModel} = loadTypeScript('presentation/movies/useMoviesViewModel.ts');
const savedFilters = {genre: 'action', quality: '1080p', minimum_rating: 8, sort_by: 'year', order_by: 'asc'};

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

function fixture({platform = 'web', defaults = DEFAULT_BROWSE_DEFAULTS, params = {}, hydrating = false} = {}) {
    const requests = [];
    const writtenParams = [];
    const listeners = new Set();
    const paramListeners = new Set();
    const focusSnapshots = [];
    let hydrated = !hydrating;
    let current;
    let routeParams = params;
    const repository = {listMovies: async options => {
        requests.push(options);
        return {movies: [], movieCount: 0, hasMore: false};
    }};
    function MoviesScreen({viewModel, autoFocus}) {
        current = {viewModel, autoFocus};
        focusSnapshots.push(autoFocus);
        React.useEffect(() => {viewModel.loadInitial();}, [viewModel.loadInitial]);
        const count = ['genre', 'quality', 'minimum_rating'].filter(key => viewModel.appliedFilters[key] != null).length;
        return React.createElement('main', null,
            React.createElement('input', {readOnly: true, value: viewModel.searchQuery}),
            count ? React.createElement('button', null, `${count} filters`) : null,
            React.createElement('output', null, JSON.stringify(viewModel.appliedFilters)),
            autoFocus ? React.createElement('dialog', {open: true}, 'Search') : null);
    }
    const {default: BrowseRoute} = loadTypeScript('app/movies.tsx', {
        react: {...React, useSyncExternalStore: (subscribe, getSnapshot, getServerSnapshot) => React.useSyncExternalStore(
            listener => {listeners.add(listener); return () => listeners.delete(listener);},
            () => hydrated && getSnapshot(), getServerSnapshot)},
        'react-native': {Platform: {OS: platform}},
        'expo-router': {useLocalSearchParams: () => React.useSyncExternalStore(
            listener => {paramListeners.add(listener); return () => paramListeners.delete(listener);},
            () => routeParams, () => routeParams), router: {setParams: value => {
            writtenParams.push(value);
            routeParams = {...routeParams, ...value};
            for (const listener of paramListeners) listener();
        }}},
        'expo-router/head': () => null,
        '@/instrumentation/ScreenDisplay': {ScreenDisplay: () => null},
        '@/presentation': {
            canonicalUrl: () => 'https://example.test/movies', usePageMeta() {}, MoviesScreen,
            useMoviesViewModel, useMovieRepository: () => repository,
            usePreferencesRepository: () => ({getBrowseDefaults: () => defaults}),
        },
    });
    return {
        BrowseRoute, requests, writtenParams, focusSnapshots,
        get current() {return current;},
        hydrate() {hydrated = true; for (const listener of listeners) listener();},
        navigate(next) {routeParams = next;},
    };
}

async function mount(t, f) {
    let renderer;
    await act(async () => {renderer = create(React.createElement(f.BrowseRoute));});
    t.after(async () => {await act(async () => renderer.unmount());});
    return renderer;
}

test('exported Movies markup matches the first web render with saved defaults, URL filters, search and autofocus', () => {
    const empty = fixture();
    const html = renderToString(React.createElement(empty.BrowseRoute));
    assert.doesNotMatch(html, /filters|dialog/);
    for (const options of [
        {defaults: savedFilters},
        {params: {query: 'Dune', focus: '1'}},
        {defaults: savedFilters, params: {genre: 'comedy', minimum_rating: '7', query: 'Arrival', focus: '1'}},
    ]) {
        const f = fixture(options);
        assert.equal(renderToString(React.createElement(f.BrowseRoute)), html);
        assert.deepEqual(f.requests, []);
        assert.deepEqual(f.writtenParams, []);
    }
});

test('hydration restores saved filters and the first request already uses them without resetting the URL', async t => {
    const f = fixture({defaults: savedFilters, hydrating: true});
    await mount(t, f);
    assert.deepEqual(f.current.viewModel.appliedFilters, {sort_by: 'date_added', order_by: 'desc'});
    assert.equal(f.requests.length, 2);
    for (const request of f.requests) {
        for (const [key, value] of Object.entries(savedFilters)) assert.equal(request[key], value);
    }
    assert.deepEqual(f.writtenParams, []);
    await act(async () => f.hydrate());
    assert.ok(f.writtenParams.length > 0);
    assert.equal(f.writtenParams.every(params => params.genre === 'action' && params.minimum_rating === '8'), true);
    assert.deepEqual(f.current.viewModel.appliedFilters, savedFilters);
    assert.equal(f.requests.length, 2);
});

test('URL filters override saved defaults and search/focus appear after hydration without another request', async t => {
    const f = fixture({defaults: savedFilters, params: {genre: 'comedy', minimum_rating: '7', query: 'Dune', focus: '1'}, hydrating: true});
    await mount(t, f);
    assert.equal(f.current.viewModel.searchQuery, '');
    assert.equal(f.current.autoFocus, false);
    assert.equal(f.requests.length, 2);
    for (const request of f.requests) {
        assert.equal(request.query, 'Dune');
        assert.equal(request.genre, 'comedy');
        assert.equal(request.minimum_rating, 7);
        assert.equal(request.quality, undefined);
    }
    await act(async () => f.hydrate());
    assert.equal(f.current.viewModel.searchQuery, 'Dune');
    assert.deepEqual(f.current.viewModel.appliedFilters, {genre: 'comedy', minimum_rating: 7});
    assert.equal(f.current.autoFocus, true);
    assert.equal(f.requests.length, 2);
});

test('URL cleanup cannot consume initial mobile search focus before hydration reveals it', async t => {
    const f = fixture({defaults: savedFilters, params: {query: 'Dune', focus: '1'}, hydrating: true});
    await mount(t, f);
    assert.equal(f.focusSnapshots.includes(true), false);
    assert.deepEqual(f.writtenParams, []);
    await act(async () => f.hydrate());
    assert.equal(f.focusSnapshots.includes(true), true);
    assert.equal(f.writtenParams.at(-1).focus, undefined);
    assert.equal(f.current.viewModel.searchQuery, 'Dune');
    assert.equal(f.requests.length, 2);
});

test('later URL navigation and clearing filters are not overwritten by the hydration fallback', async t => {
    const f = fixture({defaults: savedFilters});
    const renderer = await mount(t, f);
    f.navigate({genre: 'drama', query: 'Alien'});
    await act(async () => renderer.update(React.createElement(f.BrowseRoute)));
    assert.equal(f.current.viewModel.searchQuery, 'Alien');
    assert.deepEqual(f.current.viewModel.appliedFilters, {genre: 'drama'});
    assert.equal(f.requests.at(-1).query, 'Alien');
    await act(async () => f.current.viewModel.clearFiltersAndReload());
    assert.equal(f.current.viewModel.searchQuery, '');
    assert.deepEqual(f.current.viewModel.appliedFilters, {});
    assert.equal(f.writtenParams.at(-1).genre, undefined);
});

test('native first renders retain saved filters and URL search without a web hydration fallback', () => {
    for (const platform of ['android', 'ios']) {
        const f = fixture({platform, defaults: savedFilters, params: {query: 'Dune', focus: '1'}});
        const html = renderToString(React.createElement(f.BrowseRoute));
        assert.match(html, /3 filters/);
        assert.match(html, /value="Dune"/);
        assert.match(html, /dialog/);
    }
});
