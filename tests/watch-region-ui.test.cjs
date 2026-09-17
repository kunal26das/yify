const assert = require('node:assert/strict');
const {test} = require('node:test');
const React = require('react');
const {act, create} = require('react-test-renderer');
const {loadTypeScript} = require('./helpers/load-typescript.cjs');

globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const nodeText = node => typeof node === 'string' ? node : node.children?.map(nodeText).join('') ?? '';
const labels = renderer => renderer.root.findAllByType('Text').map(nodeText).join(' ');

async function mount(t, repository) {
    const FlatList = props => React.createElement('FlatList', props,
        props.data.length ? props.data.map((item, index) => React.cloneElement(props.renderItem({item, index}),
            {key: props.keyExtractor(item)})) : props.ListEmptyComponent);
    const {WatchRegionPicker} = loadTypeScript('presentation/movies/components/WatchRegionPicker.tsx', {
        'react-native': {View: 'View', TextInput: 'TextInput', Modal: 'Modal', Pressable: 'Pressable',
            KeyboardAvoidingView: 'KeyboardAvoidingView', ActivityIndicator: 'Loading', FlatList,
            Platform: {OS: 'web', select: options => options.web ?? options.default},
            StyleSheet: {create: value => value, absoluteFill: {}, hairlineWidth: 1}},
        '@expo/vector-icons/Ionicons': 'Icon',
        'react-native-safe-area-context': {useSafeAreaInsets: () => ({top: 0, bottom: 0})},
        '../../di/DependenciesContext': {useTmdbRepository: () => repository},
        '../../components/motion': {PressableScale: 'PressableScale'},
        '../../components/themed-text': {ThemedText: 'Text'},
        '../../hooks/use-palette': {usePalette: () => ({colors: {}})},
    });
    const calls = {selected: [], closed: 0};
    let renderer;
    await act(async () => {renderer = create(React.createElement(WatchRegionPicker, {
        selected: null, automatic: 'IN', onSelect: code => calls.selected.push(code), onClose: () => calls.closed++,
    }));});
    t.after(async () => {await act(async () => renderer.unmount());});
    return {renderer, calls};
}

test('the country picker uses the existing TMDB regions, sorts them and searches by country code', async t => {
    let requests = 0;
    const {renderer, calls} = await mount(t, {getWatchRegions: async () => {
        requests++;
        return [{code: 'US', name: 'United States'}, {code: 'IN', name: 'India'}];
    }});
    assert.equal(requests, 1);
    assert.match(labels(renderer), /Use device country · India/);
    assert.deepEqual(renderer.root.findByType('FlatList').props.data.map(item => item.code), ['IN', 'US']);
    await act(async () => renderer.root.findByType('TextInput').props.onChangeText('US'));
    const region = renderer.root.findAllByType('PressableScale').find(node => nodeText(node) === 'United States');
    assert.equal(region.props.accessibilityRole, 'button');
    await act(async () => region.props.onPress());
    assert.deepEqual(calls, {selected: ['US'], closed: 1});
    assert.equal(requests, 1);
});

test('region lookup failures retry only on request and preserve the automatic country choice', async t => {
    let failed = true;
    let requests = 0;
    const {renderer, calls} = await mount(t, {getWatchRegions: async () => {
        requests++;
        if (failed) throw new Error('offline');
        return [{code: 'IN', name: 'India'}];
    }});
    assert.match(labels(renderer), /Countries couldn’t be loaded/);
    assert.equal(requests, 1);
    failed = false;
    const retry = renderer.root.findAllByType('PressableScale').find(node => nodeText(node) === 'Try again');
    await act(async () => retry.props.onPress());
    assert.equal(requests, 2);
    assert.doesNotMatch(labels(renderer), /Countries couldn’t be loaded/);
    const automatic = renderer.root.findAllByType('PressableScale').find(node => nodeText(node) === 'Use device country · India');
    assert.equal(automatic.props.accessibilityState.selected, true);
    await act(async () => automatic.props.onPress());
    assert.deepEqual(calls, {selected: [null], closed: 1});
});
