const assert = require('node:assert/strict');
const {test} = require('node:test');
const React = require('react');
const {renderToString} = require('react-dom/server');
const {act, create} = require('react-test-renderer');
const {loadTypeScript} = require('./helpers/load-typescript.cjs');

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

function fixture({platform = 'web', region = 'US', savedRegion = null} = {}) {
    let automatic = region;
    const defaults = {watchRegion: null, streamingServices: {}};
    const saved = {...defaults, watchRegion: savedRegion};
    const subscribe = () => () => {};
    const mocks = {
        'react-native': {Platform: {OS: platform, select: options => options[platform] ?? options.default}, View: ({children}) => React.createElement('div', null, children),
            StyleSheet: {create: value => value}},
        'expo-localization': {getLocales: () => [{regionCode: automatic}]},
        '@expo/vector-icons/Ionicons': () => null,
        '../../di/DependenciesContext': {usePreferencesRepository: () => ({})},
        '../../components/motion': {PressableScale: ({children, accessibilityLabel}) => React.createElement('button', {'aria-label': accessibilityLabel}, children)},
        '../../components/themed-text': {ThemedText: ({children}) => React.createElement('span', null, children)},
        '../../hooks/use-palette': {usePalette: () => ({colors: {}})},
        '../../hooks/use-preferences': {usePreferences: () => React.useSyncExternalStore(subscribe, () => saved, () => defaults)},
        './StreamingServicesPicker': {StreamingServicesPicker: () => null},
        './WatchRegionPicker': {WatchRegionPicker: () => null, countryName: code => new Intl.DisplayNames(['en'], {type: 'region'}).of(code)},
    };
    const {MyStreamingServices} = loadTypeScript('presentation/movies/components/MyStreamingServices.tsx', mocks);
    const {useDeviceRegion} = loadTypeScript('presentation/movies/components/watchRegion.ts', mocks);
    function Region() {
        return React.createElement('span', null, useDeviceRegion());
    }
    return {MyStreamingServices, Region, setRegion: value => {automatic = value;}};
}

test('streaming services server markup is identical for US, Indian, Japanese and Dutch browser locales', () => {
    const f = fixture();
    const expected = renderToString(React.createElement(f.MyStreamingServices));
    assert.match(expected, /currently United States/);
    for (const region of ['IN', 'JP', 'NL']) {
        f.setRegion(region);
        assert.equal(renderToString(React.createElement(f.MyStreamingServices)), expected);
    }
});

test('the mounted client restores its actual country without persisting a server fallback', async t => {
    for (const [region, country] of [['IN', 'India'], ['JP', 'Japan'], ['NL', 'Netherlands']]) {
        const f = fixture({region});
        let renderer;
        await act(async () => {renderer = create(React.createElement(f.MyStreamingServices));});
        t.after(async () => {await act(async () => renderer.unmount());});
        const countryButton = renderer.root.findAllByType('button').find(node => node.props['aria-label'].startsWith('Change viewing country'));
        assert.equal(countryButton.props['aria-label'], `Change viewing country, currently ${country}`);
    }
});

test('a saved viewing country still overrides the device country after mounting', async t => {
    const f = fixture({region: 'IN', savedRegion: 'JP'});
    assert.match(renderToString(React.createElement(f.MyStreamingServices)), /currently United States/);
    let renderer;
    await act(async () => {renderer = create(React.createElement(f.MyStreamingServices));});
    t.after(async () => {await act(async () => renderer.unmount());});
    const countryButton = renderer.root.findAllByType('button').find(node => node.props['aria-label'].startsWith('Change viewing country'));
    assert.equal(countryButton.props['aria-label'], 'Change viewing country, currently Japan');
});

test('native region detection remains available on the first render', () => {
    for (const platform of ['android', 'ios']) {
        const f = fixture({platform, region: 'IN'});
        assert.equal(renderToString(React.createElement(f.Region)), '<span>IN</span>');
        f.setRegion('NL');
        assert.equal(renderToString(React.createElement(f.Region)), '<span>NL</span>');
    }
});
