const assert = require('node:assert/strict');
const {test} = require('node:test');
const React = require('react');
const {act, create} = require('react-test-renderer');
const {loadTypeScript} = require('./helpers/load-typescript.cjs');

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const noop = () => {};

function fixture() {
    const mocks = {
        'react-native': {View: 'View', TextInput: 'TextInput', StyleSheet: {create: value => value, hairlineWidth: 1},
            Platform: {OS: 'web', select: options => options.web ?? options.default}},
        '@expo/vector-icons/Ionicons': 'Icon',
        '../../components/motion': {PressableScale: 'PressableScale'},
        '../../components/themed-text': {ThemedText: 'Text'},
        '../../components/toast': {useToast: () => noop},
        '../../hooks/use-palette': {usePalette: () => ({colors: {}})},
        '../../hooks/use-responsive': {useResponsive: () => ({isPhone: true})},
        '../../hooks/use-preferences': {usePreferences: () => ({watchRegion: 'IN', streamingServices: {}})},
        '../../di/DependenciesContext': {usePreferencesRepository: () => ({setWatchRegion: noop, setStreamingServices: noop})},
        './ChipBar': {ChipBar: 'ChipBar'},
        './WatchlistSheet': {WatchlistSheet: ({visible, ...props}) => visible ? React.createElement('FilterSheet', props) : null},
        './WatchRegionPicker': {countryName: () => 'India', WatchRegionPicker: 'CountryPicker'},
        './StreamingServicesPicker': {StreamingServicesPicker: 'ServicesPicker'},
        './watchRegion': {useDeviceRegion: () => 'IN'},
        './openStreamingLink': {openStreamingLink: async () => {}},
    };
    const {WatchlistControls} = loadTypeScript('presentation/movies/components/WatchlistControls.tsx', mocks);
    const {WatchlistStreamingControls} = loadTypeScript('presentation/movies/components/WatchlistStreamingControls.tsx', mocks);
    return {WatchlistControls, WatchlistStreamingControls};
}

async function mount(t, Component, props) {
    let renderer;
    await act(async () => {renderer = create(React.createElement(Component, props));});
    t.after(async () => {await act(async () => renderer.unmount());});
    return renderer;
}

async function press(renderer, label) {
    const button = renderer.root.findAllByType('PressableScale').find(node =>
        typeof label === 'string' ? node.props.accessibilityLabel === label : label.test(node.props.accessibilityLabel ?? ''));
    assert.ok(button, `Missing control: ${label}`);
    await act(async () => button.props.onPress());
}

test('watchlist filters report actual opening, button/system closure and unmount to the card visibility owner', async t => {
    const {WatchlistControls} = fixture();
    const changes = [];
    const renderer = await mount(t, WatchlistControls, {
        options: {}, onChange: noop, genres: [], collections: [], onManageCollections: noop, onPick: noop, canPick: true,
        onModalVisibilityChange: visible => changes.push(visible),
    });
    assert.deepEqual(changes, [false]);
    await press(renderer, 'Sort and filter');
    assert.equal(renderer.root.findAllByType('FilterSheet').length, 1);
    assert.deepEqual(changes, [false, true]);
    await press(renderer, 'Done');
    assert.equal(renderer.root.findAllByType('FilterSheet').length, 0);
    assert.deepEqual(changes, [false, true, false]);
    await press(renderer, 'Sort and filter');
    await act(async () => renderer.root.findByType('FilterSheet').props.onClose());
    assert.deepEqual(changes, [false, true, false, true, false]);
    await press(renderer, 'Sort and filter');
    await act(async () => renderer.unmount());
    assert.deepEqual(changes, [false, true, false, true, false, true, false]);
});

test('streaming controls forward real country/service modal visibility and remain obscured until both close', async t => {
    const {WatchlistStreamingControls} = fixture();
    const changes = [];
    const renderer = await mount(t, WatchlistStreamingControls, {
        streaming: {busy: false, services: [], nextCount: 0, uncheckedCount: 0, checkedCount: 0, failedCount: 0,
            totalCount: 3, missingIdCount: 0, setOnlySelected: noop},
        onModalVisibilityChange: visible => changes.push(visible),
    });
    assert.deepEqual(changes, [false]);
    await press(renderer, /^Change viewing country/);
    assert.equal(renderer.root.findAllByType('CountryPicker').length, 1);
    assert.deepEqual(changes, [false, true]);
    await act(async () => renderer.root.findByType('CountryPicker').props.onClose());
    assert.deepEqual(changes, [false, true, false]);
    await press(renderer, /^My streaming services/);
    assert.equal(renderer.root.findAllByType('ServicesPicker').length, 1);
    assert.deepEqual(changes, [false, true, false, true]);
    await press(renderer, /^Change viewing country/);
    await act(async () => renderer.root.findByType('ServicesPicker').props.onClose());
    assert.equal(renderer.root.findAllByType('ServicesPicker').length, 0);
    assert.equal(renderer.root.findAllByType('CountryPicker').length, 1);
    assert.deepEqual(changes, [false, true, false, true]);
    await act(async () => renderer.root.findByType('CountryPicker').props.onClose());
    assert.deepEqual(changes, [false, true, false, true, false]);
    await press(renderer, /^My streaming services/);
    await act(async () => renderer.unmount());
    assert.deepEqual(changes, [false, true, false, true, false, true, false]);
});
