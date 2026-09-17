const assert = require('node:assert/strict');
const {test} = require('node:test');
const React = require('react');
const {act, create} = require('react-test-renderer');
const {loadTypeScript} = require('./helpers/load-typescript.cjs');

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const nodeText = node => typeof node === 'string' ? node : node.children?.map(nodeText).join('') ?? '';
const labels = renderer => renderer.root.findAllByType('Text').map(nodeText).join(' ');
const catalog = {
    status: 'ready',
    countries: [
        {code: 'IN', name: 'India', services: [
            {id: 'netflix', name: 'Netflix'},
            {id: 'prime', name: 'Prime Video'},
            {id: 'prime:paramount', name: 'Paramount+', parentName: 'Prime Video'},
            {id: 'apple:tvs.sbd.1000249', name: 'Paramount+', parentName: 'Apple TV'},
        ]},
        {code: 'US', name: 'United States', services: [{id: 'hulu', name: 'Hulu'}, {id: 'netflix', name: 'Netflix'}]},
        {code: 'NL', name: 'Netherlands', services: []},
    ],
};

function fixture({initial = {}, getCatalog = async country => ({...catalog, countries: catalog.countries.filter(item => item.code === country)}), openLink = async () => {}} = {}) {
    let preferences = {watchRegion: null, streamingServices: {}, ...initial};
    const listeners = new Set();
    const calls = {catalog: 0, countries: [], selections: [], links: [], toasts: []};
    const notify = () => listeners.forEach(listener => listener());
    const repository = {
        setWatchRegion: watchRegion => {preferences = {...preferences, watchRegion}; notify();},
        setStreamingServices: (country, ids) => {
            calls.selections.push([country, ids]);
            preferences = {...preferences, streamingServices: {...preferences.streamingServices, [country]: ids}};
            notify();
        },
    };
    const streaming = {getCatalog: async country => {calls.catalog++; calls.countries.push(country); return getCatalog(country);}};
    const FlatList = props => React.createElement('FlatList', props,
        props.ListHeaderComponent,
        props.data.length ? props.data.map((item, index) => React.cloneElement(props.renderItem({item, index}),
            {key: props.keyExtractor(item)})) : props.ListEmptyComponent,
        props.ListFooterComponent);
    const {MyStreamingServices} = loadTypeScript('presentation/movies/components/MyStreamingServices.tsx', {
        'react-native': {View: 'View', TextInput: 'TextInput', Modal: 'Modal', Pressable: 'Pressable',
            KeyboardAvoidingView: 'KeyboardAvoidingView', ActivityIndicator: 'Loading', FlatList,
            useWindowDimensions: () => ({width: 360, height: 640}),
            Platform: {OS: 'web', select: options => options.web ?? options.default},
            StyleSheet: {create: value => value, absoluteFill: {}, hairlineWidth: 1}},
        '@expo/vector-icons/Ionicons': 'Icon',
        'react-native-safe-area-context': {useSafeAreaInsets: () => ({top: 0, bottom: 0})},
        '../../di/DependenciesContext': {usePreferencesRepository: () => repository, useStreamingRepository: () => streaming},
        '../../components/motion': {PressableScale: 'PressableScale'},
        '../../components/themed-text': {ThemedText: 'Text'},
        '../../components/toast': {useToast: () => message => calls.toasts.push(message)},
        '../../hooks/use-palette': {usePalette: () => ({colors: {}})},
        '../../hooks/use-preferences': {usePreferences: () => React.useSyncExternalStore(
            listener => {listeners.add(listener); return () => listeners.delete(listener);}, () => preferences)},
        './watchRegion': {deviceRegion: () => 'IN'},
        './openStreamingLink': {openStreamingLink: async url => {calls.links.push(url); await openLink(url);}},
        './WatchRegionPicker': {countryName: code => ({IN: 'India', US: 'United States', NL: 'Netherlands', FR: 'France'}[code] ?? code),
            WatchRegionPicker: 'CountryPicker'},
    });
    return {MyStreamingServices, calls, preferences: () => preferences, repository};
}

async function mount(t, fixture) {
    let renderer;
    await act(async () => {renderer = create(React.createElement(fixture.MyStreamingServices));});
    t.after(async () => {await act(async () => renderer.unmount());});
    return renderer;
}

function control(renderer, label) {
    const match = renderer.root.findAllByType('PressableScale').find(node =>
        typeof label === 'string' ? node.props.accessibilityLabel === label : label.test(node.props.accessibilityLabel ?? ''));
    assert.ok(match, `Missing control: ${label}`);
    return match;
}

async function press(renderer, label) {
    await act(async () => control(renderer, label).props.onPress());
}

async function close(renderer) {
    await act(async () => renderer.root.findByType('Modal').props.onRequestClose());
}

test('service preferences load only on demand and keep each country’s choices separate', async t => {
    const f = fixture({initial: {streamingServices: {US: ['hulu']}}});
    const renderer = await mount(t, f);
    assert.equal(f.calls.catalog, 0);
    assert.match(labels(renderer), /My streaming services Add your services India/);
    await press(renderer, /^My streaming services/);
    assert.equal(f.calls.catalog, 1);
    assert.deepEqual(f.calls.countries, ['IN']);
    await press(renderer, 'Netflix');
    assert.deepEqual(f.preferences().streamingServices, {US: ['hulu'], IN: ['netflix']});
    assert.equal(control(renderer, 'Netflix').props.accessibilityState.checked, true);
    await close(renderer);
    await press(renderer, /^Change viewing country/);
    const picker = renderer.root.findByType('CountryPicker');
    assert.equal(picker.props.automatic, 'IN');
    await act(async () => {picker.props.onSelect('US'); picker.props.onClose();});
    await press(renderer, /^My streaming services, 1 added for United States/);
    assert.equal(control(renderer, 'Hulu').props.accessibilityState.checked, true);
    assert.deepEqual(f.calls.countries, ['IN', 'US']);
    assert.equal(control(renderer, 'Netflix').props.accessibilityState.checked, false);
    await press(renderer, 'Netflix');
    assert.deepEqual(f.preferences().streamingServices, {US: ['hulu', 'netflix'], IN: ['netflix']});
    await close(renderer);
    assert.equal(renderer.root.findAllByType('Modal').length, 0);
});

test('search finds add-ons by parent service and preserves distinct platform-specific selections', async t => {
    const f = fixture();
    const renderer = await mount(t, f);
    await press(renderer, /^My streaming services/);
    assert.match(labels(renderer), /Add-on through Apple TV/);
    assert.match(labels(renderer), /Add-on through Prime Video/);
    assert.deepEqual(renderer.root.findAllByType('PressableScale').filter(node => node.props.accessibilityRole === 'checkbox')
        .map(node => node.props.accessibilityLabel), ['Netflix', 'Prime Video', 'Paramount+ through Apple TV', 'Paramount+ through Prime Video']);
    const search = renderer.root.findByType('TextInput');
    assert.equal(search.props.accessibilityLabel, 'Search streaming services');
    await act(async () => search.props.onChangeText('apple'));
    assert.equal(renderer.root.findAllByType('PressableScale').filter(node => node.props.accessibilityRole === 'checkbox').length, 1);
    const addon = control(renderer, 'Paramount+ through Apple TV');
    assert.equal(addon.props.accessibilityRole, 'checkbox');
    assert.equal(addon.props.accessibilityState.checked, false);
    await press(renderer, 'Paramount+ through Apple TV');
    assert.deepEqual(f.preferences().streamingServices.IN, ['apple:tvs.sbd.1000249']);
    await act(async () => search.props.onChangeText('prime'));
    assert.equal(control(renderer, 'Paramount+ through Prime Video').props.accessibilityState.checked, false);
    await press(renderer, 'Paramount+ through Prime Video');
    assert.deepEqual(f.preferences().streamingServices.IN, ['apple:tvs.sbd.1000249', 'prime:paramount']);
    assert.match(labels(renderer), /without connecting accounts/);
    assert.equal(control(renderer, 'Close').props.accessibilityRole, 'button');
    assert.equal(renderer.root.findByType('Modal').props.onRequestClose instanceof Function, true);
    await act(async () => search.props.onChangeText('service that does not exist'));
    assert.match(labels(renderer), /No matching services/);
});

test('previously saved services remain removable after disappearing from the provider catalog', async t => {
    const f = fixture({initial: {streamingServices: {IN: ['retired-service', 'netflix']}}});
    const renderer = await mount(t, f);
    await press(renderer, /^My streaming services/);
    assert.match(labels(renderer), /No longer listed · tap to remove/);
    const retired = control(renderer, 'retired-service');
    assert.equal(retired.props.accessibilityState.checked, true);
    assert.equal(retired.props.accessibilityHint, 'Remove this saved service');
    await press(renderer, 'retired-service');
    assert.deepEqual(f.preferences().streamingServices.IN, ['netflix']);
    assert.doesNotMatch(labels(renderer), /retired-service/);
});

test('catalog failures preserve selections and retry only after an explicit request', async t => {
    let failed = true;
    const f = fixture({initial: {streamingServices: {IN: ['netflix']}},
        getCatalog: async () => {if (failed) throw new Error('offline'); return catalog;}});
    const renderer = await mount(t, f);
    await press(renderer, /^My streaming services/);
    assert.match(labels(renderer), /Services couldn’t be loaded/);
    assert.doesNotMatch(labels(renderer), /No streaming services listed/);
    assert.match(labels(renderer), /Saved service · tap to remove/);
    assert.deepEqual(f.preferences().streamingServices.IN, ['netflix']);
    await act(async () => renderer.root.findByType('TextInput').props.onChangeText('netflix'));
    assert.equal(f.calls.catalog, 1);
    failed = false;
    const retry = renderer.root.findAllByType('PressableScale').find(node => nodeText(node) === 'Try again');
    assert.equal(retry.props.accessibilityRole, 'button');
    await act(async () => retry.props.onPress());
    assert.equal(f.calls.catalog, 2);
    assert.doesNotMatch(labels(renderer), /Services couldn’t be loaded/);
    assert.equal(control(renderer, 'Netflix').props.accessibilityState.checked, true);
});

test('unsupported countries and supported countries without services show different states', async t => {
    const unsupported = fixture({initial: {watchRegion: 'FR'}});
    const first = await mount(t, unsupported);
    await press(first, /^My streaming services/);
    assert.match(labels(first), /Streaming availability isn’t supported in France yet/);
    assert.doesNotMatch(labels(first), /No streaming services listed/);
    const empty = fixture({initial: {watchRegion: 'NL'}});
    const second = await mount(t, empty);
    await press(second, /^My streaming services/);
    assert.match(labels(second), /No streaming services listed for Netherlands/);
    assert.doesNotMatch(labels(second), /isn’t supported/);
});

test('the service catalog visibly credits its source and handles an attribution link failure', async t => {
    const f = fixture({openLink: async () => {throw new Error('no browser');}});
    const renderer = await mount(t, f);
    await press(renderer, /^My streaming services/);
    assert.match(labels(renderer), /JustWatch ↗/);
    const attribution = control(renderer, 'Streaming services by JustWatch');
    assert.equal(attribution.props.accessibilityRole, 'link');
    assert.equal(renderer.root.findByType('FlatList').findAll(node =>
        node.props.accessibilityLabel === 'Streaming services by JustWatch').length, 0);
    await press(renderer, 'Streaming services by JustWatch');
    assert.deepEqual(f.calls.links, ['https://www.justwatch.com']);
    assert.deepEqual(f.calls.toasts, ['Couldn’t open the availability source. Please try again.']);
});
