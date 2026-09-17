const assert = require('node:assert/strict');
const {test} = require('node:test');
const React = require('react');
const {act, create} = require('react-test-renderer');
const {loadTypeScript} = require('./helpers/load-typescript.cjs');

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const nodeText = node => typeof node === 'string' ? node : node.children?.map(nodeText).join('') ?? '';
const {StreamingOffers} = loadTypeScript('presentation/movies/components/StreamingOffers.tsx', {
    'react-native': {View: 'View', ScrollView: 'ScrollView',
        Platform: {OS: 'web', select: options => options.web ?? options.default},
        StyleSheet: {create: value => value, hairlineWidth: 1}},
    '@expo/vector-icons/Ionicons': 'Icon',
    '../../components/motion': {PressableScale: 'PressableScale'},
    '../../components/themed-text': {ThemedText: 'Text'},
    '../../hooks/use-palette': {usePalette: () => ({colors: {}})},
});
const offer = (serviceId, serviceName, type = 'subscription', extra = {}) => ({
    serviceId, serviceName, selectionId: serviceId, type,
    url: 'https://www.themoviedb.org/movie/42/watch?locale=IN', ...extra,
});
const cards = renderer => renderer.root.findAllByType('PressableScale').filter(node =>
    node.props.accessibilityLabel !== 'Streaming availability by JustWatch');

async function mount(t, props) {
    let renderer;
    await act(async () => {renderer = create(React.createElement(StreamingOffers, props));});
    t.after(async () => {await act(async () => renderer.unmount());});
    return renderer;
}

test('selected streaming services appear first without treating rentals or purchases as included', async t => {
    const renderer = await mount(t, {selected: ['prime'], onOpen: () => {}, offers: [
        offer('netflix', 'Netflix'),
        offer('prime', 'Prime Video', 'rent', {price: '$3.99'}),
        offer('prime', 'Prime Video', 'subscription'),
        offer('prime', 'Prime Video', 'buy', {price: '$9.99'}),
    ]});
    const rendered = cards(renderer);
    assert.equal(rendered[0].props.accessibilityLabel, 'View options for Prime Video, Subscription, your service');
    assert.match(nodeText(rendered[0]), /Your service/);
    assert.equal(rendered.filter(node => /Your service/.test(nodeText(node))).length, 1);
    assert.ok(rendered.some(node => node.props.accessibilityLabel === 'View options for Prime Video, Rent · $3.99'));
    assert.ok(rendered.some(node => node.props.accessibilityLabel === 'View options for Prime Video, Buy · $9.99'));
    assert.equal(rendered.every(node => node.props.accessibilityRole === 'link'), true);
});

test('add-on matching requires the exact selected channel on its selected platform', async t => {
    const offers = [
        offer('prime', 'Prime Video'),
        offer('prime', 'Prime Video', 'addon', {selectionId: 'prime:starz', addonName: 'Starz'}),
        offer('apple', 'Apple TV', 'addon', {selectionId: 'apple:starz', addonName: 'Starz'}),
    ];
    const renderer = await mount(t, {offers, selected: ['prime'], onOpen: () => {}});
    assert.equal(cards(renderer).filter(node => /Your service/.test(nodeText(node))).length, 1);
    assert.equal(cards(renderer)[0].props.accessibilityLabel, 'View options for Prime Video, Subscription, your service');
    await act(async () => renderer.update(React.createElement(StreamingOffers, {offers, selected: ['apple:starz'], onOpen: () => {}})));
    assert.equal(cards(renderer)[0].props.accessibilityLabel, 'View options for Apple TV, Extra channel · Starz, your service');
    assert.equal(cards(renderer).filter(node => /Your service/.test(nodeText(node))).length, 1);
    assert.ok(cards(renderer).some(node => node.props.accessibilityLabel === 'View options for Prime Video, Extra channel · Starz'));
});

test('offer and visible attribution links open their corresponding destination', async t => {
    const opened = [];
    const item = offer('netflix', 'Netflix');
    const renderer = await mount(t, {offers: [item], selected: [], onOpen: url => opened.push(url)});
    await act(async () => cards(renderer)[0].props.onPress());
    const attribution = renderer.root.findAllByType('PressableScale').find(node =>
        node.props.accessibilityLabel === 'Streaming availability by JustWatch');
    assert.equal(attribution.props.accessibilityRole, 'link');
    assert.match(nodeText(attribution), /Availability by JustWatch/);
    await act(async () => attribution.props.onPress());
    assert.deepEqual(opened, [item.url, 'https://www.justwatch.com']);
});

test('ad-supported offers keep their label and stay noninteractive without a supplied watch-page link', async t => {
    const opened = [];
    const renderer = await mount(t, {offers: [offer('tubi', 'Tubi', 'ads', {url: undefined})],
        selected: ['tubi'], onOpen: url => opened.push(url)});
    const item = cards(renderer)[0];
    assert.equal(item.props.accessibilityLabel, 'Tubi, Free with ads, your service');
    assert.equal(item.props.accessibilityRole, 'text');
    assert.equal(item.props.disabled, true);
    assert.equal(item.props.onPress, undefined);
    assert.doesNotMatch(nodeText(item), /View options/);
    assert.deepEqual(opened, []);
});
