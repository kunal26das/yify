const assert = require('node:assert/strict');
const {test} = require('node:test');
const React = require('react');
const {act, create} = require('react-test-renderer');
const {loadTypeScript} = require('./helpers/load-typescript.cjs');

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const release = {
    id: 'nyaa:123', title: 'A'.repeat(500), category: 'english', size: '250 MiB',
    uploadedAt: new Date('2026-09-19T09:30:00Z'), seeds: 3, peers: 2, downloadCount: 4,
};
const model = overrides => ({
    releases: [], status: 'ready', refreshing: false, refreshFailed: false,
    query: '', category: 'all', limit: 75, reload() {}, submitSearch() {}, selectCategory() {},
    ...overrides,
});
const text = node => typeof node === 'string' ? node : node.children?.map(text).join('') ?? '';

function screenFor(platform) {
    const scrolls = [];
    const FlatList = React.forwardRef(function List(props, ref) {
        React.useImperativeHandle(ref, () => ({scrollToOffset: value => scrolls.push(value)}));
        return React.createElement('List', null, props.ListHeaderComponent,
            props.data.length ? props.data.map(item => React.createElement(React.Fragment, {key: item.id}, props.renderItem({item})))
                : props.ListEmptyComponent,
            props.ListFooterComponent);
    });
    const {AnimeScreen} = loadTypeScript('presentation/anime/AnimeScreen.tsx', {
        'react-native': {
            ActivityIndicator: 'ActivityIndicator', FlatList, RefreshControl: 'RefreshControl',
            ScrollView: 'ScrollView', TextInput: 'TextInput', View: 'View',
            StyleSheet: {create: value => value},
            Platform: {OS: platform, select: value => value[platform] ?? value.default},
        },
        '@expo/vector-icons/Ionicons': 'Icon',
        'react-native-safe-area-context': {useSafeAreaInsets: () => ({top: 24, bottom: 16})},
        '../components/motion': {PressableScale: 'Button'},
        '../components/screen': {Screen: ({children, overlays}) => React.createElement('Screen', null, children, overlays)},
        '../components/themed-text': {ThemedText: 'Text'},
        '../hooks/use-palette': {usePalette: () => ({colors: new Proxy({}, {get: () => '#333333'})})},
        '../hooks/use-responsive': {useResponsive: () => ({contentMaxWidth: 320, gutter: 16, isPhone: true})},
        '../movies/components/TopBar': {useTopBarHeight: () => 132},
        '../movies/components/TopBarSlot': {TopBarSlot: 'TopBarSlot'},
    });
    return {AnimeScreen, scrolls};
}

for (const platform of ['android', 'web']) {
    test(`${platform} anime search waits for submission, can clear, and filters remain usable after errors`, async t => {
        const {AnimeScreen, scrolls} = screenFor(platform);
        const searches = [], categories = [];
        let renderer;
        await act(async () => {renderer = create(React.createElement(AnimeScreen, {viewModel: model({
            status: 'unavailable', submitSearch: query => searches.push(query), selectCategory: category => categories.push(category),
        })}));});
        t.after(async () => {await act(async () => renderer.unmount());});
        assert.equal(renderer.root.findByType('TopBarSlot').props.showSearch, false);
        const input = () => renderer.root.findByType('TextInput');
        const button = label => renderer.root.findAllByType('Button').find(item => item.props.accessibilityLabel === label);
        await act(async () => input().props.onChangeText('Star Sailor'));
        assert.deepEqual(searches, [], 'typing alone must not send source requests');
        await act(async () => input().props.onSubmitEditing());
        assert.deepEqual(searches, ['Star Sailor']);
        assert.deepEqual(scrolls.at(-1), {offset: 0, animated: false});
        await act(async () => button('Clear anime search').props.onPress());
        assert.equal(input().props.value, '');
        assert.deepEqual(searches, ['Star Sailor', '']);
        await act(async () => button('English translated').props.onPress());
        assert.deepEqual(categories, ['english']);
        assert.ok(button('Retry loading anime uploads'));
    });

    test(`${platform} anime uploads retain their full title and distinguish upload time from release date`, async t => {
        const {AnimeScreen} = screenFor(platform);
        let renderer;
        await act(async () => {renderer = create(React.createElement(AnimeScreen, {viewModel: model({releases: [release]})}));});
        t.after(async () => {await act(async () => renderer.unmount());});
        const title = renderer.root.findAllByType('Text').find(node => text(node) === release.title);
        assert.ok(title, 'a long filename remains visible in full');
        assert.equal(title.props.numberOfLines, undefined);
        assert.equal(title.props.selectable, true);
        assert.ok(renderer.root.findAllByType('Text').some(node => text(node).startsWith('Uploaded ')));
        assert.equal(renderer.root.findAllByType('Button').some(node => node.props.accessibilityRole === 'link'), false);
    });
}
