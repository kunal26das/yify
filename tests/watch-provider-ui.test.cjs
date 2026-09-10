const assert = require('node:assert/strict');
const {test} = require('node:test');
const React = require('react');
const {act, create} = require('react-test-renderer');
const {loadTypeScript} = require('./helpers/load-typescript.cjs');

globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const noop = () => {};
const nodeText = node => typeof node === 'string' ? node : node.children?.map(nodeText).join('') ?? '';
const labels = renderer => renderer.root.findAllByType('Text').map(nodeText).join(' ');
const deferred = () => {let resolve; const promise = new Promise(done => {resolve = done;}); return {promise, resolve};};

function setup(repository) {
    const listeners = new Set();
    let preference = {watchRegion: null};
    const opened = [];
    const preferences = {setWatchRegion: code => {preference = {watchRegion: code}; listeners.forEach(listener => listener());}};
    const {WatchProviders} = loadTypeScript('presentation/movies/components/WatchProviders.tsx', {
        'react-native': {View: 'View', ScrollView: 'ScrollView', ActivityIndicator: 'Loading',
            Platform: {OS: 'web', select: values => values.web ?? values.default}, Linking: {openURL: async url => opened.push(url)},
            StyleSheet: {create: value => value, hairlineWidth: 1}},
        '@expo/vector-icons/Ionicons': 'Icon', 'expo-image': {Image: 'Image'},
        'expo-web-browser': {openBrowserAsync: async url => opened.push(url)},
        'expo-localization': {getLocales: () => [{regionCode: 'IN'}]},
        'react-native-reanimated': {__esModule: true, default: {View: 'AnimatedView'}},
        '../../di/DependenciesContext': {useTmdbRepository: () => repository, usePreferencesRepository: () => preferences},
        '../../hooks/use-preferences': {usePreferences: () => React.useSyncExternalStore(
            listener => {listeners.add(listener); return () => listeners.delete(listener);}, () => preference)},
        '../../hooks/use-palette': {usePalette: () => ({colors: {}})},
        '../../components/toast': {useToast: () => noop},
        '../../components/motion': {PressableScale: 'PressableScale', enterFade: noop},
        '../../components/themed-text': {ThemedText: 'Text'},
        '@/presentation/analytics/events': {Analytics: {watchProviderOpen: noop}},
        './WatchRegionPicker': {countryName: code => ({IN: 'India', US: 'United States'}[code] ?? code), WatchRegionPicker: 'CountryPicker'},
    });
    return {WatchProviders, preferences, opened};
}

async function mount(t, component) {
    let renderer;
    await act(async () => {renderer = create(React.createElement(component, {imdbCode: 'tt1234567', title: 'Example', media: 'tv'}));});
    t.after(async () => {await act(async () => renderer.unmount());});
    return renderer;
}

test('TV viewing options show unfamiliar providers, country, attribution and official watch-page link', async t => {
    const url = 'https://www.themoviedb.org/tv/42/watch?locale=IN';
    const calls = [];
    const {WatchProviders, opened} = setup({findByImdbCode: async () => ({tmdbId: 42, media: 'tv'}),
        getWatchAvailability: async (...args) => {calls.push(args); return {region: 'IN', url, providers: [
            {id: 90001, name: 'Regional service', offer: 'free'}, {id: 90001, name: 'Regional service', offer: 'buy'},
        ]};}});
    const renderer = await mount(t, WatchProviders);
    assert.deepEqual(calls, [[42, 'tv', 'IN']]);
    assert.match(labels(renderer), /Where to watch India/);
    assert.match(labels(renderer), /Regional service Free Regional service Buy/);
    assert.match(labels(renderer), /Availability by JustWatch/);
    const link = renderer.root.findAllByType('PressableScale').find(node => node.props.accessibilityLabel === 'Free on Regional service, view options');
    await act(async () => link.props.onPress());
    assert.deepEqual(opened, [url]);
});

test('lookup failures expose a retry and recover without claiming there are no providers', async t => {
    let fail = true;
    const {WatchProviders} = setup({findByImdbCode: async () => {if (fail) throw new Error('offline'); return {tmdbId: 42, media: 'tv'};},
        getWatchAvailability: async () => ({region: 'IN', providers: []})});
    const renderer = await mount(t, WatchProviders);
    assert.match(labels(renderer), /Viewing options couldn’t be loaded/);
    assert.doesNotMatch(labels(renderer), /No viewing options/);
    fail = false;
    const retry = renderer.root.findAllByType('PressableScale').find(node => nodeText(node) === 'Try again');
    await act(async () => retry.props.onPress());
    assert.match(labels(renderer), /No viewing options listed for India/);
});

test('changing country hides old offers immediately and ignores a late previous-country response', async t => {
    const indian = deferred();
    const {WatchProviders, preferences} = setup({findByImdbCode: async () => ({tmdbId: 42, media: 'tv'}),
        getWatchAvailability: async (_id, _media, region) => region === 'IN' ? indian.promise :
            {region: 'US', providers: [{id: 90002, name: 'American service', offer: 'stream'}]}});
    const renderer = await mount(t, WatchProviders);
    await act(async () => preferences.setWatchRegion('US'));
    assert.match(labels(renderer), /United States/);
    assert.match(labels(renderer), /American service/);
    await act(async () => indian.resolve({region: 'IN', providers: [{id: 90001, name: 'Old service', offer: 'stream'}]}));
    assert.doesNotMatch(labels(renderer), /Old service/);
    assert.match(labels(renderer), /American service/);
    const country = renderer.root.findAllByType('PressableScale').find(node => node.props.accessibilityLabel?.startsWith('Change viewing country'));
    await act(async () => country.props.onPress());
    assert.equal(renderer.root.findByType('CountryPicker').props.selected, 'US');
});
