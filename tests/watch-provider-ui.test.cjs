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
const offer = (serviceName, extra = {}) => ({serviceId: '90001', serviceName, selectionId: '90001', type: 'subscription', ...extra});

function setup(streaming, {openLink = async () => {}} = {}) {
    const listeners = new Set();
    let preference = {watchRegion: null, streamingServices: {}};
    const opened = [];
    const toasts = [];
    const preferences = {setWatchRegion: code => {preference = {...preference, watchRegion: code}; listeners.forEach(listener => listener());}};
    const {WatchProviders} = loadTypeScript('presentation/movies/components/WatchProviders.tsx', {
        'react-native': {View: 'View', ScrollView: 'ScrollView', ActivityIndicator: 'Loading',
            Platform: {OS: 'web', select: values => values.web ?? values.default},
            StyleSheet: {create: value => value, hairlineWidth: 1}},
        '@expo/vector-icons/Ionicons': 'Icon',
        'expo-localization': {getLocales: () => [{regionCode: 'IN'}]},
        'react-native-reanimated': {__esModule: true, default: {View: 'AnimatedView'}},
        '../../di/DependenciesContext': {usePreferencesRepository: () => preferences, useStreamingRepository: () => streaming},
        '../../hooks/use-preferences': {usePreferences: () => React.useSyncExternalStore(
            listener => {listeners.add(listener); return () => listeners.delete(listener);}, () => preference)},
        '../../hooks/use-palette': {usePalette: () => ({colors: {}})},
        '../../components/toast': {useToast: () => message => toasts.push(message)},
        '../../components/motion': {PressableScale: 'PressableScale', enterFade: noop},
        '../../components/themed-text': {ThemedText: 'Text'},
        '@/presentation/analytics/events': {Analytics: {watchProviderOpen: noop}},
        './openStreamingLink': {openStreamingLink: async url => {opened.push(url); await openLink(url);}},
        './WatchRegionPicker': {countryName: code => ({IN: 'India', US: 'United States'}[code] ?? code), WatchRegionPicker: 'CountryPicker'},
    });
    return {WatchProviders, preferences, opened, toasts};
}

async function mount(t, component, props = {}) {
    let renderer;
    await act(async () => {renderer = create(React.createElement(component, {imdbCode: 'tt1234567', title: 'Example', media: 'tv', ...props}));});
    t.after(async () => {await act(async () => renderer.unmount());});
    return renderer;
}

async function retry(renderer) {
    const button = renderer.root.findAllByType('PressableScale').find(node => nodeText(node) === 'Try again');
    assert.ok(button);
    await act(async () => button.props.onPress());
}

test('TV viewing options request availability once with media and show the provider watch-page links', async t => {
    const url = 'https://www.themoviedb.org/tv/42/watch?locale=IN';
    const calls = [];
    const {WatchProviders, opened} = setup({getAvailability: async (...args) => {
        calls.push(args); return {country: 'IN', status: 'ready', offers: [
            offer('Regional service', {type: 'free', url}), offer('Regional service', {type: 'buy', url}),
        ]};
    }});
    const renderer = await mount(t, WatchProviders);
    assert.deepEqual(calls, [['tt1234567', 'IN', 'tv']]);
    assert.match(labels(renderer), /Where to watch India/);
    assert.match(labels(renderer), /Regional service Free View options Regional service Buy View options/);
    assert.match(labels(renderer), /JustWatch ↗/);
    const link = renderer.root.findAllByType('PressableScale').find(node => node.props.accessibilityLabel === 'View options for Regional service, Free');
    await act(async () => link.props.onPress());
    assert.deepEqual(opened, [url]);
});

test('lookup failures expose a retry and recover without claiming there are no providers', async t => {
    let fail = true;
    const {WatchProviders} = setup({getAvailability: async () => {
        if (fail) throw new Error('offline');
        return {country: 'IN', status: 'ready', offers: []};
    }});
    const renderer = await mount(t, WatchProviders);
    assert.match(labels(renderer), /Viewing options couldn’t be loaded/);
    assert.doesNotMatch(labels(renderer), /No viewing options/);
    fail = false;
    await retry(renderer);
    assert.match(labels(renderer), /No viewing options listed for India/);
});

test('changing country hides old offers immediately and ignores a late previous-country response', async t => {
    const indian = deferred();
    const {WatchProviders, preferences} = setup({getAvailability: async (_id, region) => region === 'IN' ? indian.promise :
        {country: 'US', status: 'ready', offers: [offer('American service')]}});
    const renderer = await mount(t, WatchProviders);
    await act(async () => preferences.setWatchRegion('US'));
    assert.match(labels(renderer), /United States/);
    assert.match(labels(renderer), /American service/);
    await act(async () => indian.resolve({country: 'IN', status: 'ready', offers: [offer('Old service')]}));
    assert.doesNotMatch(labels(renderer), /Old service/);
    assert.match(labels(renderer), /American service/);
    const country = renderer.root.findAllByType('PressableScale').find(node => node.props.accessibilityLabel?.startsWith('Change viewing country'));
    await act(async () => country.props.onPress());
    assert.equal(renderer.root.findByType('CountryPicker').props.selected, 'US');
});

test('pending and unavailable lookups remain distinct from a confirmed empty result', async t => {
    const pending = deferred();
    let result = pending.promise;
    const {WatchProviders} = setup({getAvailability: () => result});
    const renderer = await mount(t, WatchProviders);
    assert.equal(renderer.root.findByType('Loading').props.accessibilityLabel, 'Loading viewing options');
    assert.doesNotMatch(labels(renderer), /No viewing options/);
    await act(async () => pending.resolve({country: 'IN', status: 'unavailable', offers: []}));
    assert.match(labels(renderer), /Viewing options couldn’t be loaded/);
    assert.doesNotMatch(labels(renderer), /No viewing options/);
    result = Promise.resolve({country: 'IN', status: 'ready', offers: []});
    await retry(renderer);
    assert.match(labels(renderer), /No viewing options listed/);
});

test('unsupported countries do not imply the title has no providers', async t => {
    const {WatchProviders} = setup({getAvailability: async () => ({country: 'IN', status: 'unsupported-country', offers: []})});
    const renderer = await mount(t, WatchProviders);
    assert.match(labels(renderer), /Streaming availability isn’t covered for India yet/);
    assert.doesNotMatch(labels(renderer), /No viewing options/);
});

test('unlinked providers remain visible and noninteractive', async t => {
    const {WatchProviders, opened} = setup({getAvailability: async () => ({country: 'IN', status: 'ready', offers: [offer('Regional service')]})});
    const renderer = await mount(t, WatchProviders);
    const provider = renderer.root.findAllByType('PressableScale').find(node => node.props.accessibilityLabel === 'Regional service, Subscription');
    assert.equal(provider.props.accessibilityRole, 'text');
    assert.equal(provider.props.disabled, true);
    assert.equal(provider.props.onPress, undefined);
    assert.equal(provider.findAllByType('Icon').length, 0);
    assert.match(labels(renderer), /Regional service/);
    assert.deepEqual(opened, []);
});

test('changing media reloads the correct identity and suppresses late earlier-media results', async t => {
    const tv = deferred();
    const calls = [];
    const {WatchProviders} = setup({getAvailability: async (...args) => {
        calls.push(args);
        return args[2] === 'tv' ? tv.promise : {country: 'IN', status: 'ready', offers: [offer('Movie provider')]};
    }});
    const renderer = await mount(t, WatchProviders);
    await act(async () => renderer.update(React.createElement(WatchProviders, {imdbCode: 'tt1234567', media: 'movie'})));
    await act(async () => tv.resolve({country: 'IN', status: 'ready', offers: [offer('Old TV provider')]}));
    assert.deepEqual(calls, [['tt1234567', 'IN', 'tv'], ['tt1234567', 'IN', 'movie']]);
    assert.match(labels(renderer), /Movie provider/);
    assert.doesNotMatch(labels(renderer), /Old TV provider/);
});

test('opening errors are caught and reported without losing the offers', async t => {
    const {WatchProviders, toasts} = setup({getAvailability: async () => ({country: 'IN', status: 'ready',
        offers: [offer('Regional service', {url: 'https://www.themoviedb.org/movie/42/watch?locale=IN'})]})},
    {openLink: async () => {throw new Error('no browser');}});
    const renderer = await mount(t, WatchProviders);
    const provider = renderer.root.findAllByType('PressableScale').find(node => node.props.accessibilityLabel === 'View options for Regional service, Subscription');
    await act(async () => provider.props.onPress());
    assert.deepEqual(toasts, ['Couldn’t open viewing options. Please try again.']);
    assert.match(labels(renderer), /Regional service/);
});
