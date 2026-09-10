const assert = require('node:assert/strict');
const {test} = require('node:test');
const React = require('react');
const {act, create} = require('react-test-renderer');
const {loadTypeScript} = require('./helpers/load-typescript.cjs');

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const noop = () => {};
const nodeText = node => typeof node === 'string' ? node : node.children?.map(nodeText).join('') ?? '';
const textValues = node => node.findAllByType('Text').map(nodeText);
const torrent = {
    url: '', hash: '', quality: '1080p', type: 'web', videoCodec: 'x265', bitDepth: '10',
    audioChannels: '5.1', seeds: 137, peers: 19, size: '1.50 GB', sizeBytes: 1_500_000_000,
    uploadedAt: new Date('2026-09-01T00:00:00Z'),
};

function mocks(platform = 'web') {
    const palette = {colors: new Proxy({}, {get: () => '#123456'})};
    const responsive = {width: 1200, contentMaxWidth: 1200, gutter: 24, isPhone: false, isLarge: true};
    const motion = {PressableScale: 'PressableScale', enterFade: noop, enterRise: noop, enterPop: noop};
    const gesture = new Proxy({}, {get: () => () => gesture});
    const result = {
        'react-native': {
            ActivityIndicator: 'ActivityIndicator', ScrollView: 'ScrollView', View: 'View',
            Modal: 'Modal', Pressable: 'Pressable', RefreshControl: 'RefreshControl',
            StyleSheet: {create: value => value, absoluteFill: {}, hairlineWidth: 1},
            Platform: {OS: platform, select: values => values[platform] ?? values.default},
            Linking: {openURL: () => assert.fail('torrent listings must not open a download URL')},
            Clipboard: {setString: () => assert.fail('torrent listings must not copy a download URL')},
        },
        '@expo/vector-icons/Ionicons': 'Icon',
        'expo-image': {Image: 'Image'},
        'expo-router': {router: {canGoBack: () => false, replace: noop}},
        'react-native-reanimated': {__esModule: true, default: {View: 'AnimatedView'}},
        'react-native-gesture-handler': {Gesture: {Pan: () => gesture}, GestureDetector: 'GestureDetector'},
        'react-native-safe-area-context': {useSafeAreaInsets: () => ({top: 0, bottom: 0})},
        '@gorhom/bottom-sheet': {
            BottomSheetBackdrop: 'BottomSheetBackdrop', BottomSheetModal: 'BottomSheetModal',
            BottomSheetView: 'BottomSheetView',
        },
        '@/domain': {Genre: {All: 'all'}, movieHistoryEntry: noop, showHistoryEntry: noop},
        '@/presentation/analytics/events': {Analytics: new Proxy({}, {get: () => noop})},
        '../components/screen': {
            Screen: ({children, overlays}) => React.createElement('Screen', null, children, overlays),
        },
        '../components/linear-gradient': {LinearGradient: 'LinearGradient'},
        '../components/toast': {useToast: () => noop},
        '../player/PlayerContext': {
            usePlayer: () => ({video: null, open: noop, minimize: noop, setInlineRect: noop, setQueue: noop}),
        },
        '../player/use-ad-break': {useAdBreak: () => noop},
        '../hooks/use-reload-on-catalog-access': {useReloadOnCatalogAccess: noop},
        './components/shareLink': {shareLink: noop},
        './components/DescriptionCard': {DescriptionCard: 'DescriptionCard'},
        './components/HoverCard': {HoverCardHost: 'HoverCardHost'},
        './components/MovieRail': {MovieRail: 'MovieRail'},
        './components/ScreenshotLightbox': {ScreenshotLightbox: 'ScreenshotLightbox'},
        './components/TopBar': {useTopBarHeight: () => 60},
        './components/VideoRow': {VideoRow: 'VideoRow'},
        './components/WatchProviders': {WatchProviders: 'WatchProviders'},
        './constants/destinations': {useGoTo: () => noop},
        './useWatchHistory': {useRecordHistory: () => noop},
        '../useWatchlist': {useIsInWatchlist: () => false, useToggleWatchlist: () => noop},
    };
    for (const prefix of ['../', '../../']) {
        result[`${prefix}components/motion`] = motion;
        result[`${prefix}components/themed-text`] = {ThemedText: 'Text'};
        result[`${prefix}hooks/use-palette`] = {usePalette: () => palette};
        result[`${prefix}hooks/use-responsive`] = {useResponsive: () => responsive};
        result[`${prefix}hooks/use-preferences`] = {usePreferences: () => ({historyPaused: true})};
        result[`${prefix}hooks/use-android-back`] = {useAndroidBackHandler: noop};
        result[`${prefix}hooks/use-haptics`] = {useHaptics: () => ({commit: noop})};
    }
    return result;
}

async function mount(t, component, props) {
    let renderer;
    await act(async () => { renderer = create(React.createElement(component, props)); });
    t.after(async () => { await act(async () => renderer.unmount()); });
    return renderer;
}

async function verifyNotice(renderer, row) {
    assert.equal(Boolean(row.props.disabled), false);
    assert.equal(row.props.accessibilityRole, 'button');
    await act(async () => row.props.onPress());
    const modal = renderer.root.findByType('Modal');
    assert.equal(modal.props.visible, true);
    assert.ok(textValues(modal).includes("Downloads aren't available"));
    const actions = modal.findAllByType('PressableScale');
    assert.equal(actions.length, 1);
    assert.match(nodeText(actions[0]), /^Got\s+it$/);
    await act(async () => actions[0].props.onPress());
    assert.equal(renderer.root.findByType('Modal').props.visible, false);
}

test('public movie qualities keep their statistics and original notice with no download link', async t => {
    const {WatchScreen} = loadTypeScript('presentation/movies/WatchScreen.tsx', mocks());
    const renderer = await mount(t, WatchScreen, {viewModel: {
        details: {
            id: 42, title: 'Example movie', titleLong: 'Example movie (2026)', year: 2026,
            rating: 8, runtimeMinutes: 120, genres: ['Drama'], posterUrls: [], downloadCount: 2500,
            torrents: [torrent], cast: [], screenshotUrls: [], screenshotThumbUrls: [],
        },
        suggestions: [], loading: false, refreshing: false, error: null, reload: noop, refresh: noop,
    }});
    assert.ok(textValues(renderer.root).includes('Available qualities'));
    assert.ok(renderer.root.findAll(item => item.props.accessibilityLabel === '2500 downloads').length > 0);
    const row = renderer.root.findAllByType('PressableScale').find(item =>
        item.props.accessibilityLabel === '1080p web · x265, 1.50 GB');
    assert.ok(row);
    assert.deepEqual(textValues(row), ['1080p', 'web · x265', '1.50 GB', '137', '19']);
    await verifyNotice(renderer, row);
    const download = renderer.root.findAllByType('PressableScale').find(item =>
        item.props.accessibilityLabel === 'Download');
    assert.ok(download);
    await verifyNotice(renderer, download);
});

for (const platform of ['web', 'android']) {
    test(`${platform} episode statistics and informational notice do not require a magnet link`, async t => {
        const {ShowDetailsScreen} = loadTypeScript('presentation/movies/ShowDetailsScreen.tsx', mocks(platform));
        const episode = {
            id: 'release-42', title: 'Example episode', season: 1, episode: 2,
            seeds: 137, peers: 19, sizeBytes: 1_500_000_000, magnetUrl: '',
            releasedAt: new Date('2026-09-01T00:00:00Z'),
        };
        const renderer = await mount(t, ShowDetailsScreen, {
            imdbId: '42',
            shows: {
                async listShows() { return {shows: [{imdbId: '42', title: 'Example show'}]}; },
                async listEpisodes() { return [episode]; },
            },
            artwork: {async findByImdbCode() { return null; }},
        });
        const row = renderer.root.findAllByType('PressableScale').find(item =>
            item.props.accessibilityLabel === 'S01E02 Example episode');
        assert.ok(row);
        assert.deepEqual(textValues(row), ['S01E02', 'Example episode', '1.50 GB', '137', '19']);
        await verifyNotice(renderer, row);
    });
}
