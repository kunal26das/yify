const assert = require('node:assert/strict');
const {test} = require('node:test');
const React = require('react');
const {act, create} = require('react-test-renderer');
const {loadTypeScript} = require('./helpers/load-typescript.cjs');

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const noop = () => {};
const domain = loadTypeScript('domain/index.ts');
const {LibraryRepositoryImpl} = loadTypeScript('data/repositories/LibraryRepositoryImpl.ts', {'@/domain': domain});
const {WatchlistRepositoryImpl} = loadTypeScript('data/repositories/WatchlistRepositoryImpl.ts');
const movie = (id, title, extra = {}) => ({id, title, titleLong: title, imdbCode: `tt${id}`, year: 2020,
    rating: 7, runtimeMinutes: 100, genres: ['Drama'], summary: '', language: 'en', mpaRating: '', posterUrls: [], ...extra});
const movies = [
    movie(1, 'Zulu', {year: 2010, rating: 8, runtimeMinutes: 80, ytTrailerCode: 'trailer-1'}),
    movie(2, 'Amelie', {year: 2001, rating: 9, runtimeMinutes: 122, ytTrailerCode: 'trailer-2'}),
    movie(3, 'Bright', {year: 2026, genres: ['Comedy'], runtimeMinutes: 90}),
];

function store() {
    const values = new Map();
    return {getString: key => values.get(key), set: (key, value) => values.set(key, value)};
}

function fixture(isPhone = false) {
    const library = new LibraryRepositoryImpl(store(), () => 100);
    const watchlist = new WatchlistRepositoryImpl(store());
    watchlist.applyRemote(movies);
    library.setWatched(2, true);
    const calls = {navigation: [], playback: [], analytics: [], confirmations: []};
    const player = {open: item => calls.playback.push(['open', item]), setQueue: items => calls.playback.push(['queue', items])};
    const colors = new Proxy({}, {get: () => '#123456'});
    const palette = {colors};
    const responsive = {isPhone, isLarge: !isPhone, width: isPhone ? 360 : 1200, contentMaxWidth: 1200, gutter: 16};
    const confirm = request => calls.confirmations.push(request);
    const FlatList = React.forwardRef((props, _ref) => React.createElement('FlatList', props,
        props.ListHeaderComponent,
        props.data.length ? props.data.map((item, index) => React.cloneElement(props.renderItem({item, index}), {key: item.id})) : props.ListEmptyComponent));
    const mocks = {
        '@/domain': domain,
        'react-native': {FlatList, View: 'View', TextInput: 'TextInput', ScrollView: 'ScrollView',
            Platform: {OS: 'web', select: options => options.web ?? options.default},
            PixelRatio: {get: () => 1}, StyleSheet: {create: value => value, absoluteFill: {}, hairlineWidth: 1}},
        '@expo/vector-icons/Ionicons': 'Icon',
        'expo-image': {Image: 'Image'},
        'react-native-reanimated': {__esModule: true, default: {View: 'AnimatedView'}},
        'react-native-safe-area-context': {useSafeAreaInsets: () => ({top: 0, bottom: 0})},
        '@/presentation/analytics/events': {Analytics: new Proxy({}, {get: (_, name) => (...args) => calls.analytics.push([name, ...args])})},
        '../components/screen': {Screen: ({children, overlays}) => React.createElement('Screen', null, children, overlays)},
        '../components/linear-gradient': {LinearGradient: 'LinearGradient'},
        '../components/toast': {useToast: () => noop},
        '../di/DependenciesContext': {useLibraryRepository: () => library, useWatchlistRepository: () => watchlist},
        '../player/PlayerContext': {usePlayer: () => player},
        './components/HoverCard': {HoverCardHost: 'HoverCardHost'},
        './components/MoviePosterItem': {MoviePosterItem: 'Poster'},
        './components/ScrollProgress': {ScrollProgress: 'ScrollProgress'},
        './components/TopBar': {useTopBarHeight: () => 60},
        './constants/destinations': {useGoTo: () => path => calls.navigation.push(path)},
        './ChipBar': {ChipBar: ({chips, active, onSelect}) => React.createElement('Chips', null,
            chips.map(chip => React.createElement('PressableScale', {key: chip.key, accessibilityLabel: chip.label,
                accessibilityRole: 'button', accessibilityState: {selected: active === chip.key}, onPress: () => onSelect(chip.key)}, chip.label)))},
        './WatchlistSheet': {WatchlistSheet: ({visible, title, children}) => visible ? React.createElement('Sheet', {title}, children) : null,
            WatchlistSheetInput: 'TextInput'},
    };
    for (const prefix of ['../', '../../']) {
        mocks[`${prefix}components/motion`] = {PressableScale: 'PressableScale', enterRise: noop, shiftLayout: {}};
        mocks[`${prefix}components/themed-text`] = {ThemedText: 'Text'};
        mocks[`${prefix}components/toast`] = {useToast: () => noop};
        mocks[`${prefix}components/confirm-dialog`] = {useConfirm: () => confirm};
        mocks[`${prefix}hooks/use-palette`] = {usePalette: () => palette};
        mocks[`${prefix}hooks/use-responsive`] = {useResponsive: () => responsive};
        mocks[`${prefix}hooks/use-preferences`] = {usePreferences: () => ({confirmWatchlistRemoval: true})};
    }
    const {WatchlistScreen} = loadTypeScript('presentation/movies/WatchlistScreen.tsx', mocks);
    return {Screen: WatchlistScreen, library, watchlist, calls};
}

async function mount(t, fixture) {
    let renderer;
    await act(async () => {renderer = create(React.createElement(fixture.Screen));});
    t.after(async () => {await act(async () => renderer.unmount());});
    return renderer;
}

const ids = renderer => renderer.root.findAllByType('Poster').map(node => node.props.movie.id);
const action = (renderer, label) => renderer.root.findAllByType('PressableScale').find(node => node.props.accessibilityLabel === label);
const press = async (renderer, label) => {
    const button = action(renderer, label);
    assert.ok(button, `Missing action: ${label}`);
    assert.notEqual(button.props.disabled, true, `${label} is disabled`);
    await act(async () => button.props.onPress());
};
const input = async (renderer, label, text) => {
    const field = renderer.root.findAllByType('TextInput').find(node => node.props.accessibilityLabel === label);
    assert.ok(field, `Missing input: ${label}`);
    await act(async () => field.props.onChangeText(text));
};

test('search, sort and runtime controls update the grid; picking opens a matching detail without playback', async t => {
    const f = fixture(true);
    const renderer = await mount(t, f);
    assert.deepEqual(ids(renderer), [1, 2, 3]);
    await input(renderer, 'Search watchlist', 'Zulu');
    assert.deepEqual(ids(renderer), [1]);
    await press(renderer, 'Pick for me');
    assert.deepEqual(f.calls.navigation, ['/movie/1']);
    assert.deepEqual(f.calls.playback, []);
    await press(renderer, 'Clear watchlist search');
    await press(renderer, 'Sort and filter');
    await press(renderer, 'Title A–Z');
    assert.deepEqual(ids(renderer), [2, 3, 1]);
    await press(renderer, 'Up to 90 min');
    assert.deepEqual(ids(renderer), [3, 1]);
    await press(renderer, 'Done');
    await input(renderer, 'Search watchlist', 'missing title');
    assert.deepEqual(ids(renderer), []);
    assert.equal(action(renderer, 'Pick for me').props.disabled, true);
    await press(renderer, 'Clear watchlist filters');
    assert.deepEqual(ids(renderer), [1, 2, 3]);
});

test('watched toggles are explicit, update status filters, and never change the saved titles', async t => {
    const f = fixture();
    const renderer = await mount(t, f);
    await press(renderer, 'Watched');
    assert.deepEqual(ids(renderer), [2]);
    assert.equal(action(renderer, 'Pick for me').props.disabled, true);
    await press(renderer, 'To watch');
    assert.deepEqual(ids(renderer), [1, 3]);
    await press(renderer, 'Mark as watched: Zulu');
    assert.equal(f.library.isWatched(1), true);
    assert.deepEqual(ids(renderer), [3]);
    await press(renderer, 'Watched');
    assert.deepEqual(ids(renderer), [1, 2]);
    await press(renderer, 'Mark as to watch: Zulu');
    assert.equal(f.library.isWatched(1), false);
    assert.deepEqual(ids(renderer), [2]);
    assert.deepEqual(f.watchlist.getAll().map(movie => movie.id), [1, 2, 3]);
});

test('collection create, membership, rename, filtering and confirmed deletion preserve saved movies', async t => {
    const f = fixture();
    const renderer = await mount(t, f);
    await press(renderer, 'Manage Zulu');
    await press(renderer, 'New collection');
    await input(renderer, 'Collection name', 'Weekend');
    await press(renderer, 'Create collection');
    const collection = domain.liveLibraryCollections(f.library.getState())[0];
    assert.equal(collection.name, 'Weekend');
    assert.equal(domain.libraryCollectionContains(f.library.getState(), collection.id, 1), true);
    await press(renderer, 'Remove from Weekend');
    assert.equal(domain.libraryCollectionContains(f.library.getState(), collection.id, 1), false);
    await press(renderer, 'Add to Weekend');
    await act(async () => renderer.root.findByType('Sheet').parent.props.onClose());
    await press(renderer, 'Manage collections');
    await press(renderer, 'Rename Weekend');
    await input(renderer, 'Collection name', 'Friday night');
    await press(renderer, 'Save name');
    await press(renderer, 'View Friday night');
    assert.deepEqual(ids(renderer), [1]);
    await press(renderer, 'Manage collections');
    await press(renderer, 'Delete Friday night');
    assert.equal(domain.liveLibraryCollections(f.library.getState()).length, 1);
    assert.equal(f.calls.confirmations.length, 1);
    await act(async () => f.calls.confirmations[0].onConfirm());
    assert.equal(domain.liveLibraryCollections(f.library.getState()).length, 0);
    assert.deepEqual(ids(renderer), [1, 2, 3]);
    assert.deepEqual(f.watchlist.getAll().map(movie => movie.id), [1, 2, 3]);
    assert.deepEqual(f.calls.analytics, []);
});

test('the original trailer playlist and removal confirmation continue to work', async t => {
    const f = fixture();
    const renderer = await mount(t, f);
    await press(renderer, 'Play all trailers');
    assert.deepEqual(f.calls.playback[0][1].map(item => item.videoId), ['trailer-1', 'trailer-2']);
    assert.equal(f.calls.playback[1][1].videoId, 'trailer-1');
    assert.deepEqual(f.calls.navigation, ['/movie/1']);
    await press(renderer, 'Manage Zulu');
    await press(renderer, 'Remove from watchlist');
    assert.equal(f.watchlist.contains(1), true);
    assert.equal(f.calls.confirmations.length, 1);
    await act(async () => f.calls.confirmations[0].onConfirm());
    assert.equal(f.watchlist.contains(1), false);
    assert.deepEqual(ids(renderer), [2, 3]);
});

test('closing collection management discards an unfinished editor and its validation error', async t => {
    const f = fixture();
    const renderer = await mount(t, f);
    await press(renderer, 'Manage collections');
    await press(renderer, 'New collection');
    await input(renderer, 'Collection name', '   ');
    await press(renderer, 'Create collection');
    assert.equal(renderer.root.findAll(node => node.props.accessibilityRole === 'alert').length, 1);
    await input(renderer, 'Collection name', 'Unfinished collection');
    await act(async () => renderer.root.findByType('Sheet').parent.props.onClose());
    await press(renderer, 'Manage collections');
    assert.equal(renderer.root.findAllByType('TextInput').filter(node => node.props.accessibilityLabel === 'Collection name').length, 0);
    assert.equal(renderer.root.findAll(node => node.props.accessibilityRole === 'alert').length, 0);
    await press(renderer, 'New collection');
    assert.equal(renderer.root.findAllByType('TextInput').find(node => node.props.accessibilityLabel === 'Collection name').props.value, '');
    assert.deepEqual(domain.liveLibraryCollections(f.library.getState()), []);
});
