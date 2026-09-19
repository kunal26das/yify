const assert = require('node:assert/strict');
const {test} = require('node:test');
const React = require('react');
const {act, create} = require('react-test-renderer');
const {loadTypeScript} = require('./helpers/load-typescript.cjs');

globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const domain = loadTypeScript('domain/index.ts');
const noop = () => {};
const movie = {id: 7, title: 'Selected film', titleLong: 'Selected film (2024)', imdbCode: 'tt1234567', year: 2024,
    rating: 7, runtimeMinutes: 90, genres: ['Drama'], summary: '', language: 'en', mpaRating: '', posterUrls: []};

async function fixture(t, {platform = 'android', movies = [movie], account = {uid: 'alice'}, screen = 'watchlist', large = false} = {}) {
    const calls = {saved: [], removed: [], watched: [], navigation: [], events: [], signIn: 0, dismissed: [], sheetOrder: [], modalVisibility: []};
    const listeners = new Set(); let session = {ready: true, available: true, account, signingIn: false, error: null};
    const journal = {ready: true, entries: [], syncing: false, error: null};
    const state = {watched: {}, memberships: {}, collections: {}, clearedAt: 0};
    const library = {isWatched: () => false, setWatched: (...args) => calls.watched.push(args)};
    const responsive = {width: large ? 1024 : 360, contentMaxWidth: 1680, gutter: 16, isPhone: !large, isLarge: large};
    let sheetId = 0;
    const Sheet = React.forwardRef((props, ref) => {
        const [visible, setVisible] = React.useState(false);
        const [id] = React.useState(() => ++sheetId);
        const latest = React.useRef(props); latest.current = props;
        React.useImperativeHandle(ref, () => ({
            present() {calls.sheetOrder.push(['present', id]); setVisible(true);},
            dismiss() {calls.sheetOrder.push(['dismiss', id]); setVisible(false); calls.dismissed.push(() => latest.current.onDismiss?.());},
        }), [id]);
        return visible ? React.createElement('Sheet', props) : null;
    });
    let modalId = 0;
    const Modal = ({visible, children}) => {
        const [id] = React.useState(() => ++modalId);
        React.useEffect(() => {calls.modalVisibility.push([id, visible]);}, [id, visible]);
        return visible ? React.createElement('NativeModal', {id}, children) : null;
    };
    let scrollId = 0;
    const ScrollView = props => {
        const [id] = React.useState(() => ++scrollId);
        const [offset, setOffset] = React.useState(0);
        return React.createElement('ScrollView', {...props, scrollInstance: id, scrollTop: offset, simulateScroll: setOffset});
    };
    const Control = ({label, onPress, disabled}) => React.createElement('Button', {accessibilityLabel: label, onPress, disabled}, label);
    const FlatList = React.forwardRef((props, ref) => React.createElement('List', {ref}, props.ListHeaderComponent,
        ...props.data.map(item => React.createElement(React.Fragment, {key: item.id}, props.renderItem({item}))),
        props.data.length ? null : props.ListEmptyComponent));
    const auth = {getSession: () => session, signIn: async () => {calls.signIn++; return false;}};
    const mocks = {
        '@/domain': domain,
        'react-native': {View: 'View', Modal, ScrollView, TextInput: 'Input', Pressable: 'Button',
            FlatList, ActivityIndicator: 'Spinner', StyleSheet: {create: value => value, hairlineWidth: 1},
            Platform: {OS: platform, select: value => value[platform] ?? value.default}},
        'expo-image': {Image: 'Image'}, '@expo/vector-icons/Ionicons': 'Icon',
        'react-native-reanimated': {__esModule: true, default: {View: 'AnimatedView'}},
        'react-native-safe-area-context': {useSafeAreaInsets: () => ({top: 0, bottom: 10})},
        '@gorhom/bottom-sheet': {BottomSheetModal: Sheet, BottomSheetBackdrop: 'Backdrop',
            BottomSheetScrollView: ScrollView, BottomSheetTextInput: 'Input'},
        '../components/screen': {Screen: ({children, overlays}) => React.createElement('Screen', null, children, overlays)},
        '../components/linear-gradient': {LinearGradient: 'Gradient'},
        '../di/DependenciesContext': {useLibraryRepository: () => library, useAuthRepository: () => auth,
            useMovieRepository: () => ({listMovies: async () => ({movies: [], hasMore: false})}),
            useJournalRepository: () => ({save: input => {calls.saved.push(input); return 'saved';}, retrySync: noop})},
        '../hooks/use-auth': {useAuth: () => React.useSyncExternalStore(listener => {listeners.add(listener); return () => listeners.delete(listener);}, () => session)},
        '../hooks/use-journal': {useJournal: () => journal},
        '../player/PlayerContext': {usePlayer: () => ({open: noop, setQueue: noop})},
        './components/HoverCard': {HoverCardHost: 'HoverCard'},
        './components/MoviePosterItem': {MoviePosterItem: 'Poster'},
        './components/ScrollProgress': {ScrollProgress: 'ScrollProgress'},
        './components/TopBar': {useTopBarHeight: () => 60},
        '../movies/components/TopBar': {useTopBarHeight: () => 60},
        '../movies/useWatchlist': {useWatchlist: () => movies},
        '../hooks/use-purchases': {usePurchases: () => ({ready: true, adsRemoved: false})},
        '../purchases/supporter-paywall': {useSupporterPaywall: () => noop},
        '../movies/constants/destinations': {useGoTo: () => route => calls.navigation.push(route)},
        './components/WatchlistStreamingControls': {WatchlistStreamingControls: () => null},
        './components/WatchlistStreamingBadge': {WatchlistStreamingBadge: () => null},
        './useWatchlist': {useWatchlist: () => movies, useRemoveFromWatchlist: () => value => calls.removed.push(value)},
        './useLibrary': {useLibrary: () => state},
        './useWatchlistStreaming': {useWatchlistStreaming: values => ({visible: values, availability: {}, services: [], country: 'IN'})},
        './constants/destinations': {useGoTo: () => route => calls.navigation.push(route)},
        './components/WatchlistControls': {WatchlistControlButton: Control,
            WatchlistControls: props => React.createElement(Control, {label: 'Manage collections', onPress: props.onManageCollections})},
        './WatchlistControls': {WatchlistControlButton: Control},
    };
    const analytics = {Analytics: new Proxy({}, {get: (_, name) => (...args) => calls.events.push([name, ...args])})};
    mocks['@/presentation/analytics/events'] = mocks['../analytics/events'] = analytics;
    for (const prefix of ['../', '../../']) {
        mocks[`${prefix}components/motion`] = {PressableScale: 'Button', enterRise: noop, shiftLayout: {}};
        mocks[`${prefix}components/themed-text`] = {ThemedText: 'Text'};
        mocks[`${prefix}components/toast`] = {useToast: () => noop};
        mocks[`${prefix}components/confirm-dialog`] = {useConfirm: () => noop};
        mocks[`${prefix}hooks/use-palette`] = {usePalette: () => ({colors: new Proxy({}, {get: () => '#123456'})})};
        mocks[`${prefix}hooks/use-responsive`] = {useResponsive: () => responsive};
        mocks[`${prefix}hooks/use-preferences`] = {usePreferences: () => ({confirmWatchlistRemoval: false})};
        mocks[`${prefix}hooks/use-android-back`] = {useAndroidBackHandler: noop};
    }
    const Component = screen === 'journal' ? loadTypeScript('presentation/journal/JournalScreen.tsx', mocks).JournalScreen
        : loadTypeScript('presentation/movies/WatchlistScreen.tsx', mocks).WatchlistScreen;
    let renderer;
    await act(async () => {renderer = create(React.createElement(Component));});
    t.after(async () => {await act(async () => renderer.unmount());});
    const button = label => renderer.root.findAllByType('Button').find(node => node.props.accessibilityLabel === label);
    return {renderer, calls, button,
        async press(label) {const found = button(label); assert.ok(found, label); await act(async () => found.props.onPress());},
        async account(next) {await act(async () => {session = {...session, account: next}; listeners.forEach(listener => listener());});},
        async finishDismissal() {await act(async () => calls.dismissed.splice(0).forEach(callback => callback()));},
    };
}

for (const platform of ['android', 'ios']) {
    test(`${platform} watchlist management opens the selected journal editor and ignores delayed old-sheet dismissal`, async t => {
        const f = await fixture(t, {platform});
        await f.press('Manage Selected film'); assert.equal(f.renderer.root.findAllByType('Sheet').length, 1);
        await f.press('Log a watch');
        assert.equal(f.renderer.root.findAllByType('Sheet').length, 1);
        assert.ok(f.button('Save entry'));
        assert.deepEqual(f.calls.sheetOrder.map(([action]) => action), ['present', 'dismiss', 'present']);
        await f.finishDismissal();
        assert.ok(f.button('Save entry'));
        await f.press('Save entry');
        assert.equal(f.calls.saved.length, 1); assert.equal(f.calls.saved[0].movie.id, movie.id);
        assert.deepEqual(f.calls.watched, []); assert.deepEqual(f.calls.removed, []);
    });

    test(`${platform} journal picker and editor use one native sheet presentation`, async t => {
        const f = await fixture(t, {platform, screen: 'journal'});
        await f.press('Log a movie');
        assert.equal(f.renderer.root.findAllByType('Sheet').length, 1);
        await f.press('Log Selected film (2024)');
        assert.equal(f.renderer.root.findAllByType('Sheet').length, 1);
        assert.ok(f.button('Save entry'));
        assert.deepEqual(f.calls.sheetOrder.map(([action]) => action), ['present']);
        await f.press('Save entry');
        assert.equal(f.calls.saved.length, 1); assert.equal(f.calls.saved[0].movie.id, movie.id);
        assert.equal(f.renderer.root.findAllByType('Sheet').length, 0);
        assert.deepEqual(f.calls.sheetOrder.map(([action]) => action), ['present', 'dismiss']);
        assert.ok(f.button('View insights'));
        assert.deepEqual(f.calls.watched, []); assert.deepEqual(f.calls.removed, []);
    });
}

test('large iOS journal selection keeps the same visible native modal until save', async t => {
    const f = await fixture(t, {platform: 'ios', screen: 'journal', large: true});
    await f.press('Log a movie');
    assert.deepEqual(f.calls.modalVisibility, [[1, false], [1, true]]);
    await f.press('Log Selected film (2024)');
    assert.deepEqual(f.calls.modalVisibility, [[1, false], [1, true]], 'selection must not dismiss or replace the native modal');
    assert.ok(f.button('Save entry'));
    await f.press('Save entry');
    assert.deepEqual(f.calls.modalVisibility, [[1, false], [1, true], [1, false]]);
    assert.equal(f.calls.saved.length, 1);
    assert.ok(f.button('View insights'));
});

for (const {platform, large} of [{platform: 'android', large: false}, {platform: 'ios', large: true}]) {
    test(`${platform} ${large ? 'modal' : 'sheet'} resets the scrolled picker body without replacing its native presentation`, async t => {
        const movies = Array.from({length: 16}, (_, index) => ({...movie, id: index + 1, title: `Saved film ${index + 1}`}));
        const f = await fixture(t, {platform, large, screen: 'journal', movies});
        await f.press('Log a movie');
        const presentationType = large ? 'NativeModal' : 'Sheet';
        const presentation = f.renderer.root.findByType(presentationType);
        const body = () => f.renderer.root.findByType(presentationType).findByType('ScrollView');
        const pickerBodyId = body().props.scrollInstance;
        await act(async () => body().props.simulateScroll(640));
        assert.equal(body().props.scrollTop, 640);
        await f.press('Log Saved film 16 (2024)');
        assert.equal(f.renderer.root.findByType(presentationType), presentation);
        assert.notEqual(body().props.scrollInstance, pickerBodyId);
        assert.equal(body().props.scrollTop, 0);
        assert.ok(f.button('Save entry'));
        assert.equal(f.calls.saved.length, 0);
        if (large) assert.deepEqual(f.calls.modalVisibility, [[1, false], [1, true]]);
        else assert.deepEqual(f.calls.sheetOrder.map(([action]) => action), ['present']);
    });
}

test('saving confirmation offers an explicit journal link without navigating or opening a paywall on render', async t => {
    const calls = [];
    const {JournalSavedNotice} = loadTypeScript('presentation/journal/JournalSavedNotice.tsx', {
        'react-native': {View: 'View', StyleSheet: {create: value => value}, Platform: {select: values => values.default}},
        '../components/motion': {PressableScale: 'Button'}, '../components/themed-text': {ThemedText: 'Text'},
        '../hooks/use-palette': {usePalette: () => ({colors: {}})},
    });
    let renderer;
    await act(async () => {renderer = create(React.createElement(JournalSavedNotice, {actionLabel: 'Open journal', onPress: () => calls.push('/journal')}));});
    t.after(async () => {await act(async () => renderer.unmount());});
    assert.deepEqual(calls, []);
    assert.equal(renderer.root.findAllByType('Text').some(node => node.props.accessibilityLiveRegion === 'polite'), true);
    await act(async () => renderer.root.findByType('Button').props.onPress());
    assert.deepEqual(calls, ['/journal']);
});

test('empty watchlists still expose the journal and collection management never logs a made-up movie', async t => {
    const f = await fixture(t, {movies: []});
    await f.press('Movie journal'); assert.deepEqual(f.calls.navigation, ['/journal']);
    await f.press('Manage collections');
    assert.equal(f.button('Log a watch'), undefined);
    assert.deepEqual(f.calls.saved, []);
});

test('guest watchlist logging explicitly signs in and account changes do not carry unsaved notes', async t => {
    const f = await fixture(t, {account: null});
    await f.press('Manage Selected film'); await f.press('Log a watch');
    assert.equal(f.button('Save entry'), undefined);
    await f.press('Sign in with Google'); assert.equal(f.calls.signIn, 1);
    await f.account({uid: 'alice'});
    const note = () => f.renderer.root.findAllByType('Input').find(node => node.props.accessibilityLabel === 'Private note');
    await act(async () => note().props.onChangeText('Unsaved private draft'));
    await f.account({uid: 'bob'});
    assert.equal(note().props.value, '');
    await f.press('Cancel journal entry'); assert.equal(f.renderer.root.findAllByType('Sheet').length, 0);
    assert.deepEqual(f.calls.saved, []);
});

test('movie action logging dispatches only its callback and leaves existing save/share/download actions intact', async t => {
    const calls = [];
    const {WatchActions} = loadTypeScript('presentation/movies/components/WatchActions.tsx', {
        'react-native': {ScrollView: 'ScrollView', View: 'View', StyleSheet: {create: value => value}, Platform: {select: values => values.default}},
        '@expo/vector-icons/Ionicons': 'Icon',
        '@/presentation/analytics/events': {Analytics: {watchlistAdd: () => calls.push('analytics-save')}},
        '../useWatchlist': {useIsInWatchlist: () => false, useToggleWatchlist: () => () => calls.push('save')},
        '../../components/motion': {PressableScale: 'Button'}, '../../components/themed-text': {ThemedText: 'Text'},
        '../../hooks/use-palette': {usePalette: () => ({colors: {}})},
        '../../hooks/use-haptics': {useHaptics: () => ({commit: () => calls.push('haptic')})},
    });
    let renderer;
    await act(async () => {renderer = create(React.createElement(WatchActions, {details: {...movie, torrents: [{}]},
        onLogWatch: () => calls.push('journal'), onShare: () => calls.push('share'), onDownload: () => calls.push('download')}));});
    t.after(async () => {await act(async () => renderer.unmount());});
    const press = async label => act(async () => renderer.root.findAllByType('Button').find(node => node.props.accessibilityLabel === label).props.onPress());
    await press('Log a watch'); assert.deepEqual(calls, ['journal']);
    await press('Save to Watchlist'); await press('Share'); await press('Download');
    assert.deepEqual(calls, ['journal', 'analytics-save', 'haptic', 'save', 'share', 'download']);
});

test('journal keeps Watchlist navigation selected without adding a redundant top-level destination', () => {
    const {navKeyForPath, DESTINATIONS} = loadTypeScript('presentation/movies/constants/destinations.ts', {
        'react-native': {Platform: {OS: 'web'}}, 'expo-router': {},
    });
    assert.equal(navKeyForPath('/journal'), 'watchlist');
    assert.equal(DESTINATIONS.some(value => value.href === '/journal'), false);
});
