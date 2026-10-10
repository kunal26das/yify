const assert = require('node:assert/strict');
const {test} = require('node:test');
const React = require('react');
const {act, create} = require('react-test-renderer');
const {loadTypeScript} = require('./helpers/load-typescript.cjs');

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const {useHomeViewModel} = loadTypeScript('presentation/movies/useHomeViewModel.ts', {
    '../hooks/use-reload-on-catalog-access': {useReloadOnCatalogAccess() {}},
});
const {createHomeShelfSelector} = loadTypeScript('presentation/movies/homeShelfSelection.ts');

function deferred() {
    let resolve;
    let reject;
    const promise = new Promise((done, fail) => {resolve = done; reject = fail;});
    return {promise, resolve, reject};
}

function result(id, hasMore = false) {
    return {movies: id == null ? [] : [{id, title: `Movie ${id}`, backgroundImageUrl: 'cover'}],
        pageNumber: 1, movieCount: id == null ? 0 : 1, hasMore};
}

async function fixture(t) {
    const requests = [];
    const repository = {listMovies: params => {
        const pending = deferred();
        requests.push({params, ...pending});
        return pending.promise;
    }};
    let value;
    let renderer;
    function Probe() {
        value = useHomeViewModel(repository);
        return null;
    }
    await act(async () => {renderer = create(React.createElement(Probe));});
    t.after(async () => {await act(async () => renderer.unmount());});
    return {requests, get value() {return value;}, run: async action => {
        await act(async () => {action(value);});
    }};
}

test('older hero success and cleanup cannot replace a newer refresh', async t => {
    const f = await fixture(t);
    await f.run(model => model.loadInitial());
    await f.run(model => model.reload());
    assert.equal(f.requests.length, 2);
    await f.run(() => f.requests[1].resolve(result(2)));
    await f.run(() => f.requests[0].resolve(result(1)));
    assert.deepEqual(f.value.heroMovies.map(movie => movie.id), [2]);
    assert.equal(f.value.loading, false);
    assert.equal(f.value.refreshing, false);
    assert.equal(f.value.error, null);
});

test('older shelf response and cleanup cannot alter the refreshed shelf or queue', async t => {
    const f = await fixture(t);
    await f.run(model => model.loadInitial());
    await f.run(() => f.requests[0].resolve(result(100)));
    await f.run(model => model.loadShelf('just-added'));
    await f.run(model => model.reload());
    await f.run(model => model.loadShelf('just-added'));
    assert.equal(f.requests.length, 4);
    await f.run(() => f.requests[2].resolve(result(1)));
    assert.equal(f.value.shelves[0].status, 'loading');
    await f.run(() => f.requests[3].resolve(result(2)));
    assert.deepEqual(f.value.shelves[0].movies.map(movie => movie.id), [2]);
    assert.equal(f.value.shelves[0].page, 1);
    assert.equal(f.value.shelves[0].status, 'loaded');
    await f.run(() => f.requests[1].resolve(result(99)));
    assert.equal(f.value.shelves[0].status, 'loaded');
    assert.deepEqual(f.value.shelves[0].movies.map(movie => movie.id), [2]);
});

test('failed hero refresh keeps loaded titles and a later retry clears the failure', async t => {
    const f = await fixture(t);
    await f.run(model => model.loadInitial());
    await f.run(() => f.requests[0].resolve(result(7)));
    await f.run(model => model.reload());
    assert.deepEqual(f.value.heroMovies.map(movie => movie.id), [7]);
    await f.run(() => f.requests[1].reject(new Error('catalog unavailable')));
    assert.deepEqual(f.value.heroMovies.map(movie => movie.id), [7]);
    assert.equal(f.value.error, 'catalog unavailable');
    await f.run(model => model.reload());
    await f.run(() => f.requests[2].resolve(result(8)));
    assert.deepEqual(f.value.heroMovies.map(movie => movie.id), [8]);
    assert.equal(f.value.error, null);
});

test('empty hero allows a populated shelf, and failed shelf retries without discarding saved content', async t => {
    const f = await fixture(t);
    await f.run(model => model.loadInitial());
    await f.run(() => f.requests[0].resolve(result(null)));
    assert.equal(f.value.error, null);
    await f.run(model => model.loadShelf('just-added'));
    await f.run(() => f.requests[1].resolve(result(3)));
    assert.deepEqual(f.value.shelves[0].movies.map(movie => movie.id), [3]);
    await f.run(model => model.reload());
    await f.run(model => model.loadShelf('just-added'));
    await f.run(() => f.requests[3].reject(new Error('shelf unavailable')));
    assert.equal(f.value.shelves[0].status, 'error');
    assert.deepEqual(f.value.shelves[0].movies.map(movie => movie.id), [3]);
    await f.run(model => model.retryShelf('just-added', 1));
    await f.run(() => f.requests[4].resolve(result(4)));
    assert.equal(f.value.shelves[0].status, 'loaded');
    assert.deepEqual(f.value.shelves[0].movies.map(movie => movie.id), [4]);
    await f.run(() => f.requests[2].reject(new Error('hero unavailable')));
    assert.equal(f.value.error, 'hero unavailable');
    assert.deepEqual(f.value.shelves[0].movies.map(movie => movie.id), [4]);
    await f.run(model => model.reload());
    await f.run(() => f.requests[5].resolve(result(5)));
    assert.equal(f.value.error, null);
    assert.deepEqual(f.value.heroMovies.map(movie => movie.id), [5]);
});

test('a later failed shelf remains retryable while an earlier shelf is loading', () => {
    const base = {variant: 'standard', limit: 20, query: {}, page: 0, hasMore: true, movies: []};
    const selected = createHomeShelfSelector()([
        {...base, key: 'first', title: 'First', status: 'loading'},
        {...base, key: 'second', title: 'Second', status: 'error'},
    ], []);
    assert.deepEqual(selected.shelves.map(shelf => shelf.status), ['loading', 'error']);
});

test('an exhausted shelf with only duplicate titles does not leave an empty rail', () => {
    const base = {variant: 'standard', limit: 20, query: {}, page: 1, status: 'loaded', movies: [{id: 1}]};
    const exhausted = createHomeShelfSelector()([{...base, key: 'first', title: 'First', hasMore: false}], [{id: 1}]);
    assert.equal(exhausted.shelves[0].status, 'empty');
    assert.deepEqual(exhausted.needsMore, []);
    const pending = createHomeShelfSelector()([{...base, key: 'first', title: 'First', hasMore: true}], [{id: 1}]);
    assert.equal(pending.shelves[0].status, 'loading');
    assert.deepEqual(pending.needsMore, [{key: 'first', next: 2}]);
});

test('Home passes retained shelf movies to MovieRail without a loading skeleton', async t => {
    const FlatList = props => React.createElement('List', null, props.ListHeaderComponent,
        props.data.map(item => React.createElement(React.Fragment, {key: item.key}, props.renderItem({item}))),
        props.ListFooterComponent);
    const {HomeScreen} = loadTypeScript('presentation/movies/HomeScreen.tsx', {
        '@expo/vector-icons/Ionicons': 'Icon',
        'react-native': {
            Animated: {Value: class {}, event: () => () => {}, createAnimatedComponent: component => component},
            FlatList, Platform: {OS: 'web'}, RefreshControl: 'RefreshControl', ScrollView: 'ScrollView',
            StyleSheet: {create: value => value}, View: 'View',
        },
        'react-native-safe-area-context': {useSafeAreaInsets: () => ({top: 0, bottom: 0})},
        'react-native-reanimated': {__esModule: true, default: {View: 'AnimatedView'}},
        '@/presentation/analytics/events': {Analytics: new Proxy({}, {get: () => () => {}})},
        '../components/motion': {PressableScale: 'Button', enterRise: () => undefined},
        '../components/themed-text': {ThemedText: 'Text'},
        '../components/screen': {Screen: ({children}) => React.createElement('Screen', null, children)},
        '../components/WebAdvertisement': {WebAdvertisement: 'Ad'},
        '../constants/theme': {FontFamily: {bold: 'Bold'}, Radius: {pill: 20, md: 8, sm: 4},
            Spacing: {md: 12, sm: 8, lg: 16, xl: 24, xxl: 32}},
        '../hooks/use-palette': {usePalette: () => ({colors: new Proxy({}, {get: () => '#333'})})},
        '../hooks/use-reload-when-online': {useReloadWhenOnline() {}},
        '../hooks/use-responsive': {useResponsive: () => ({width: 360, height: 720, isPhone: true,
            isTablet: false, gutter: 16})},
        './components/HeroBillboard': {HeroBillboard: 'Hero'},
        './components/HomeFooter': {HomeFooter: 'Footer'},
        './components/HoverCard': {HoverCardHost: ({children}) => React.createElement('HoverCardHost', null, children)},
        './components/MovieRail': {MovieRail: props => React.createElement('Rail', props)},
        './components/PosterSkeleton': {SkeletonBlock: 'Skeleton'},
        './components/TopBar': {useTopBarHeight: () => 80},
        './components/TopTenContext': {TopTenProvider: ({children}) => React.createElement('Provider', null, children)},
        './components/moviePosterLayout': {POSTER_GAP: 12},
        './constants/destinations': {useGoTo: () => () => {}},
        './useWatchlist': {useWatchlist: () => []},
        './components/ShowStrip': {ShowStrip: 'ShowStrip'},
        './useHomeScrollVisibility': {useHomeScrollVisibility: () => ({heroVisible: false})},
        '../purchases/supporter-discovery-card': {SupporterDiscoveryCard: 'Discovery'},
        '../di/DependenciesContext': {useSupporterNudge: () => ({recordHomeVisit: () => false})},
        '../hooks/use-preview-active': {usePreviewActive: () => false},
    });
    const first = {id: 1, title: 'Retained title'};
    const hero = {id: 100, title: 'Hero title'};
    const actions = {loadInitial() {}, loadShelf() {}, retryShelf() {}, reload() {}, requestHeroTrailer() {}};
    const model = status => ({...actions, heroMovies: [hero], heroTrailers: {}, heroBackdrops: {},
        shelves: [{key: 'just-added', title: 'Just Added', variant: 'standard', query: {}, limit: 20,
            movies: [first], status, page: status === 'loaded' ? 1 : 0, hasMore: true}],
        loading: false, refreshing: status === 'loading', error: null});
    let renderer;
    await act(async () => {renderer = create(React.createElement(HomeScreen, {shelves: model('loaded')}));});
    t.after(async () => {await act(async () => renderer.unmount());});
    await act(async () => renderer.update(React.createElement(HomeScreen, {shelves: model('loading')})));
    const rail = renderer.root.findAllByType('Rail').find(node => node.props.title === 'Just Added');
    assert.ok(rail);
    assert.equal(rail.props.loading, false);
    assert.deepEqual(rail.props.movies.map(movie => movie.id), [1]);
});
