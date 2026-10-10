const assert = require('node:assert/strict');
const {test} = require('node:test');
const React = require('react');
const {act, create} = require('react-test-renderer');
const {loadTypeScript} = require('./helpers/load-typescript.cjs');

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const colors = new Proxy({}, {get: () => '#333333'});
const native = platform => ({
    Modal: 'Modal', ScrollView: 'ScrollView', TextInput: 'Input', View: 'View', Pressable: 'Pressable',
    StyleSheet: {create: value => value, hairlineWidth: 1},
    Platform: {OS: platform, select: value => value[platform] ?? value.default},
});

for (const platform of ['android', 'web']) {
    test(`${platform} search clears the applied query, preserves filters and excludes empty recent searches`, async t => {
        const requests = [], remembered = [], searches = [];
        let closed = 0;
        const history = {getRecent: () => ['Earlier search'], remember: term => remembered.push(term), forget: () => []};
        const {SearchOverlay} = loadTypeScript('presentation/movies/components/SearchOverlay.tsx', {
            'react-native': native(platform),
            '@expo/vector-icons/Ionicons': 'Icon',
            'react-native-reanimated': {__esModule: true, default: {View: 'AnimatedView'}},
            'react-native-safe-area-context': {useSafeAreaInsets: () => ({top: 0, bottom: 0})},
            '../../components/themed-text': {ThemedText: 'Text'},
            '../../components/motion': {PressableScale: 'Button', enterFade() {}, exitFade: undefined},
            '../../hooks/use-palette': {usePalette: () => ({colors})},
            '@/presentation/analytics/events': {Analytics: {search: value => searches.push(value), searchCleared() {}}},
            '../../di/DependenciesContext': {useSearchHistory: () => history},
        });
        const {useMoviesViewModel} = loadTypeScript('presentation/movies/useMoviesViewModel.ts', {
            '../hooks/use-reload-on-catalog-access': {useReloadOnCatalogAccess() {}},
        });
        const repository = {async listMovies(params) {
            requests.push(params);
            return {movies: [], movieCount: 0, hasMore: false};
        }};
        function Screen() {
            const model = useMoviesViewModel(repository, {initialQuery: 'Alien', initialFilters: {genre: 'Sci-Fi', quality: '1080p'}});
            return React.createElement(SearchOverlay, {visible: true, initialQuery: model.searchQuery,
                onSubmit: term => model.submitSearch(term, model.filters), onClose: () => closed++});
        }
        let renderer;
        await act(async () => {renderer = create(React.createElement(Screen));});
        t.after(async () => {await act(async () => renderer.unmount());});
        const input = () => renderer.root.findByType('Input');
        const clear = renderer.root.findAllByType('Button').find(node => node.props.accessibilityLabel === 'Clear search');
        await act(async () => clear.props.onPress());
        assert.equal(input().props.value, '');
        assert.equal(requests.length, 2);
        assert.ok(requests.every(request => request.query === undefined && request.genre === 'Sci-Fi' && request.quality === '1080p'));
        assert.equal(closed, 0);
        await act(async () => input().props.onSubmitEditing());
        assert.equal(closed, 1);
        assert.deepEqual(remembered, []);
        assert.deepEqual(searches, []);
        await act(async () => input().props.onChangeText('   '));
        await act(async () => input().props.onSubmitEditing());
        assert.equal(closed, 2);
        assert.deepEqual(remembered, []);
        await act(async () => input().props.onChangeText('  Arrival  '));
        await act(async () => input().props.onSubmitEditing());
        assert.deepEqual(remembered, ['Arrival']);
        assert.deepEqual(searches, ['Arrival']);
        assert.equal(requests.at(-1).query, 'Arrival');
        assert.equal(requests.at(-1).genre, 'Sci-Fi');
        assert.equal(requests.at(-1).quality, '1080p');
    });

    test(`${platform} shared sheets identify their current journal context and close normally`, async t => {
        const {WatchlistSheet} = loadTypeScript('presentation/movies/components/WatchlistSheet.tsx', {
            'react-native': native(platform),
            '@expo/vector-icons/Ionicons': 'Icon',
            '@gorhom/bottom-sheet': {BottomSheetBackdrop: 'Backdrop', BottomSheetModal: 'BottomSheet', BottomSheetScrollView: 'SheetScroll', BottomSheetTextInput: 'Input'},
            'react-native-safe-area-context': {useSafeAreaInsets: () => ({top: 0, bottom: 0})},
            '../../components/themed-text': {ThemedText: 'Text'},
            '../../components/motion': {PressableScale: 'Button'},
            '../../hooks/use-android-back': {useAndroidBackHandler() {}},
            '../../hooks/use-palette': {usePalette: () => ({colors})},
            '../../hooks/use-responsive': {useResponsive: () => ({isLarge: platform === 'web'})},
        });
        let closed = 0;
        let renderer;
        const props = {visible: true, title: 'Log a movie', onClose: () => closed++};
        await act(async () => {renderer = create(React.createElement(WatchlistSheet, props));});
        t.after(async () => {await act(async () => renderer.unmount());});
        const button = () => renderer.root.findByType('Button');
        assert.equal(button().props.accessibilityLabel, 'Close Log a movie');
        assert.equal(renderer.root.findByType('Text').props.accessibilityRole, 'header');
        await act(async () => renderer.update(React.createElement(WatchlistSheet, {...props, title: 'Choose a movie'})));
        assert.equal(button().props.accessibilityLabel, 'Close Choose a movie');
        await act(async () => button().props.onPress());
        assert.equal(closed, 1);
    });
}
