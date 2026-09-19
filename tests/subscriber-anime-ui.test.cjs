const assert = require('node:assert/strict');
const {test} = require('node:test');
const React = require('react');
const {act, create} = require('react-test-renderer');
const {loadTypeScript} = require('./helpers/load-typescript.cjs');

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

function fixture({width = 390} = {}) {
    let status = 'checking';
    let account = {uid: 'alice'};
    const listeners = new Set();
    const calls = {feed: 0, retry: 0, signals: []};
    const subscribe = listener => {listeners.add(listener); return () => listeners.delete(listener);};
    const access = {useSubscriberAccess: () => ({
        status: React.useSyncExternalStore(subscribe, () => status),
        refresh: async () => {calls.retry++;},
    })};
    const auth = {useAuth: () => ({ready: true, account})};
    const responsive = {useResponsive: () => ({width, isPhone: width < 600, gutter: 16})};
    const palette = {usePalette: () => ({colors: new Proxy({}, {get: () => '#333333'})})};
    const native = {ActivityIndicator: 'Spinner', View: 'View', ScrollView: 'ScrollView', TextInput: 'Input',
        Platform: {OS: 'web', select: values => values.web ?? values.default},
        StyleSheet: {create: value => value, hairlineWidth: 1}};
    const destinations = loadTypeScript('presentation/movies/constants/destinations.ts', {
        'react-native': native,
        'expo-router': {usePathname: () => '/movies', useNavigation: () => ({getState: () => ({routes: []})})},
    });
    const mocks = {
        'react-native': native,
        'expo-router': {usePathname: () => '/movies', Redirect: 'Redirect'},
        '@expo/vector-icons/Ionicons': 'Icon',
        'expo-image': {Image: 'Image'},
        'react-native-reanimated': {__esModule: true, default: {View: 'AnimatedView'}},
        'react-native-safe-area-context': {useSafeAreaInsets: () => ({top: 0, bottom: 0})},
        '@/presentation/analytics/events': {Analytics: new Proxy({}, {get: () => () => {}})},
        '@/instrumentation/ScreenDisplay': {ScreenDisplay: 'ScreenDisplay'},
        '../constants/destinations': {...destinations, useGoTo: () => () => {}},
        './SearchOverlay': {SearchOverlay: 'SearchOverlay'},
        './TopBarSlot': {useTopBarSlot: () => ({}), TopBarSlot: 'TopBarSlot'},
        './PlayStoreButton': {PlayStoreButton: 'PlayStoreButton'},
        '../../constants/legal': {LEGAL_LINKS: []},
        '../movies/components/TopBar': {useTopBarHeight: () => 108},
        '../movies/components/TopBarSlot': {TopBarSlot: 'TopBarSlot'},
        './AnimeScreen': {AnimeScreen: 'AnimeScreen'},
        '../di/DependenciesContext': {useAnimeRepository: () => ({listAnime: async (_params, signal) => {
            calls.feed++; calls.signals.push(signal); return {releases: [], limit: 75};
        }})},
        '../../di/DependenciesContext': {useSearchHistory: () => ({remember() {}})},
    };
    const repository = mocks['../di/DependenciesContext'].useAnimeRepository();
    mocks['../di/DependenciesContext'].useAnimeRepository = () => repository;
    mocks['./useAnimeViewModel'] = loadTypeScript('presentation/anime/useAnimeViewModel.ts', {
        '../hooks/use-reload-on-catalog-access': {useReloadOnCatalogAccess() {}},
    });
    for (const prefix of ['../', '../../']) {
        mocks[`${prefix}hooks/use-subscriber-access`] = access;
        mocks[`${prefix}hooks/use-auth`] = auth;
        mocks[`${prefix}hooks/use-palette`] = palette;
        mocks[`${prefix}hooks/use-responsive`] = responsive;
        mocks[`${prefix}components/themed-text`] = {ThemedText: 'Text'};
        mocks[`${prefix}components/motion`] = {PressableScale: 'Button', enterRise() {}};
        mocks[`${prefix}components/navigation-link`] = {NavigationLink: 'Link'};
        mocks[`${prefix}components/screen`] = {Screen: ({children, overlays}) => React.createElement('Screen', null, children, overlays)};
    }
    return {mocks, calls, async update(next, nextAccount = account) {
        await act(async () => {status = next; account = nextAccount; listeners.forEach(listener => listener());});
    }};
}

for (const width of [360, 768, 1440]) {
    test(`Anime navigation and footer stay hidden without a verified grant at ${width}px`, async t => {
        const f = fixture({width});
        const {TopBar} = loadTypeScript('presentation/movies/components/TopBar.tsx', f.mocks);
        const {HomeFooter} = loadTypeScript('presentation/movies/components/HomeFooter.tsx', f.mocks);
        let renderer;
        await act(async () => {renderer = create(React.createElement(React.Fragment, null,
            React.createElement(TopBar), React.createElement(HomeFooter)));});
        t.after(async () => {await act(async () => renderer.unmount());});
        const animeLinks = () => renderer.root.findAllByType('Link').filter(node => node.props.href === '/anime');
        for (const status of ['checking', 'denied', 'unavailable']) {
            await f.update(status);
            assert.equal(animeLinks().length, 0);
            assert.ok(renderer.root.findAllByType('Link').some(node => node.props.href === '/movies'));
        }
        await f.update('allowed');
        assert.equal(animeLinks().length, 2, 'subscriber sees Anime in navigation and Browse footer');
        await f.update('denied', null);
        assert.equal(animeLinks().length, 0, 'sign-out removes both links');
    });
}

test('direct Anime links cannot mount or fetch the feed before authorization, and revocation clears it', async t => {
    const f = fixture();
    const {SubscriberAnimeScreen} = loadTypeScript('presentation/anime/SubscriberAnimeScreen.tsx', f.mocks);
    let renderer;
    await act(async () => {renderer = create(React.createElement(SubscriberAnimeScreen));});
    t.after(async () => {await act(async () => renderer.unmount());});
    assert.equal(f.calls.feed, 0);
    assert.equal(renderer.root.findAllByType('Spinner').length, 1);
    await f.update('denied', null);
    assert.equal(f.calls.feed, 0);
    assert.equal(renderer.root.findByType('Redirect').props.href, '/movies');
    await f.update('unavailable', {uid: 'alice'});
    assert.equal(f.calls.feed, 0);
    await act(async () => renderer.root.findByType('Button').props.onPress());
    assert.equal(f.calls.retry, 1);
    await f.update('allowed');
    assert.equal(f.calls.feed, 1);
    assert.equal(renderer.root.findAllByType('AnimeScreen').length, 1);
    await f.update('checking', {uid: 'bob'});
    assert.equal(f.calls.signals[0].aborted, true, 'account switch cancels old feed and removes its component');
    assert.equal(renderer.root.findAllByType('AnimeScreen').length, 0);
    await f.update('denied');
    assert.equal(f.calls.feed, 1);
    await f.update('allowed');
    assert.equal(f.calls.feed, 2, 'new authorized account starts with a fresh feed');
    await f.update('denied', null);
    assert.equal(f.calls.signals[1].aborted, true);
    assert.equal(renderer.root.findAllByType('AnimeScreen').length, 0);
});
