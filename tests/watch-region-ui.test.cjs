const assert = require('node:assert/strict');
const {test} = require('node:test');
const React = require('react');
const {act, create} = require('react-test-renderer');
const {loadTypeScript} = require('./helpers/load-typescript.cjs');

globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const nodeText = node => typeof node === 'string' ? node : node.children?.map(nodeText).join('') ?? '';
const labels = renderer => renderer.root.findAllByType('Text').map(nodeText).join(' ');

async function mount(t, repository, countryLocation = {requestCountry: async () => ({status: 'unavailable'})}) {
    const FlatList = props => React.createElement('FlatList', props,
        props.ListHeaderComponent,
        props.data.length ? props.data.map((item, index) => React.cloneElement(props.renderItem({item, index}),
            {key: props.keyExtractor(item)})) : props.ListEmptyComponent);
    const {WatchRegionPicker} = loadTypeScript('presentation/movies/components/WatchRegionPicker.tsx', {
        'react-native': {View: 'View', TextInput: 'TextInput', Modal: 'Modal', Pressable: 'Pressable',
            KeyboardAvoidingView: 'KeyboardAvoidingView', ActivityIndicator: 'Loading', FlatList,
            useWindowDimensions: () => ({width: 360, height: 640}),
            Platform: {OS: 'web', select: options => options.web ?? options.default},
            StyleSheet: {create: value => value, absoluteFill: {}, hairlineWidth: 1}},
        '@expo/vector-icons/Ionicons': 'Icon',
        'react-native-safe-area-context': {useSafeAreaInsets: () => ({top: 0, bottom: 0})},
        '../../di/DependenciesContext': {useTmdbRepository: () => repository, useCountryLocation: () => countryLocation},
        '../../components/motion': {PressableScale: 'PressableScale'},
        '../../components/themed-text': {ThemedText: 'Text'},
        '../../hooks/use-palette': {usePalette: () => ({colors: {}})},
        './PickerSheet': {
            PickerSheetInput: 'TextInput',
            PickerSheet: ({onClose, listProps, footer}) => React.createElement('Modal', {onRequestClose: onClose},
                React.createElement(FlatList, listProps), footer),
        },
    });
    const calls = {selected: [], closed: 0};
    let renderer;
    await act(async () => {renderer = create(React.createElement(WatchRegionPicker, {
        selected: null, automatic: 'IN', onSelect: code => calls.selected.push(code), onClose: () => calls.closed++,
    }));});
    t.after(async () => {await act(async () => renderer.unmount());});
    return {renderer, calls};
}

const countryRepository = {getWatchRegions: async () => [{code: 'IN', name: 'India'}, {code: 'US', name: 'United States'}]};
const locateButton = renderer => renderer.root.findAllByType('PressableScale').find(node => node.props.accessibilityLabel === 'Use current location');

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

test('location is requested only on tap and saves a supported country', async t => {
    let requests = 0;
    const {renderer, calls} = await mount(t, countryRepository, {requestCountry: async () => {
        requests++;
        return {status: 'ready', country: 'US'};
    }});
    assert.equal(requests, 0);
    assert.doesNotMatch(labels(renderer), /Finds your country once|BigDataCloud/);
    await act(async () => locateButton(renderer).props.onPress());
    assert.equal(requests, 1);
    assert.deepEqual(calls, {selected: ['US'], closed: 1});
});

test('denied, timeout and unsupported location preserve manual country selection', async t => {
    for (const result of [{status: 'denied'}, {status: 'timeout'}, {status: 'ready', country: 'FR'}]) {
        const {renderer, calls} = await mount(t, countryRepository, {requestCountry: async () => result});
        await act(async () => locateButton(renderer).props.onPress());
        assert.deepEqual(calls, {selected: [], closed: 0});
        assert.match(labels(renderer), result.status === 'denied' ? /Location access is off/
            : result.status === 'timeout' ? /took too long/ : /isn’t supported in France/);
        assert.equal(locateButton(renderer).props.disabled, false);
        const manual = renderer.root.findAllByType('PressableScale').find(node => nodeText(node) === 'India');
        await act(async () => manual.props.onPress());
        assert.deepEqual(calls, {selected: ['IN'], closed: 1});
    }
});

test('a manual country choice cancels detection and late results cannot overwrite it', async t => {
    let finish;
    let signal;
    const {renderer, calls} = await mount(t, countryRepository, {requestCountry: requestSignal => {
        signal = requestSignal;
        return new Promise(resolve => {finish = resolve;});
    }});
    let pending;
    await act(async () => {pending = locateButton(renderer).props.onPress();});
    assert.equal(locateButton(renderer).props.disabled, true);
    const manual = renderer.root.findAllByType('PressableScale').find(node => nodeText(node) === 'India');
    await act(async () => manual.props.onPress());
    assert.equal(signal.aborted, true);
    await act(async () => {finish({status: 'ready', country: 'US'}); await pending;});
    assert.deepEqual(calls, {selected: ['IN'], closed: 1});
});

test('closing or unmounting cancels an active location request', async t => {
    let finish;
    let signal;
    const {renderer, calls} = await mount(t, countryRepository, {requestCountry: requestSignal => {
        signal = requestSignal;
        return new Promise(resolve => {finish = resolve;});
    }});
    let pending;
    await act(async () => {pending = locateButton(renderer).props.onPress();});
    await act(async () => renderer.root.findByType('Modal').props.onRequestClose());
    assert.equal(signal.aborted, true);
    await act(async () => {finish({status: 'ready', country: 'US'}); await pending;});
    assert.deepEqual(calls, {selected: [], closed: 1});
    await act(async () => {pending = locateButton(renderer).props.onPress();});
    await act(async () => renderer.unmount());
    assert.equal(signal.aborted, true);
    await act(async () => {finish({status: 'ready', country: 'US'}); await pending;});
    assert.deepEqual(calls, {selected: [], closed: 1});
});
