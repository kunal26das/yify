const assert = require('node:assert/strict');
const {test} = require('node:test');
const React = require('react');
const {act, create} = require('react-test-renderer');
const {loadTypeScript} = require('./helpers/load-typescript.cjs');

globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const {SupporterNudgeImpl} = loadTypeScript('data/services/SupporterNudgeImpl.ts');

function nudgeFixture(values = new Map()) {
    const options = {analytics: {trackEvent() {}}, enabled: () => true,
        entitlement: () => ({ready: true, available: true, adsRemoved: false, offers: [{}]}),
        store: {getString: key => values.get(key), set: (key, value) => values.set(key, value)}};
    return {values, options, nudge: new SupporterNudgeImpl(options)};
}

async function fixture(t, options = {}) {
    const f = nudgeFixture(options.values);
    const state = {ready: true, available: true, adsRemoved: false, billingIssue: false, ...options.state};
    const requests = [];
    const {SupporterDiscoveryCard} = loadTypeScript('presentation/purchases/supporter-discovery-card.tsx', {
        'react-native': {View: 'View', Pressable: 'Pressable', StyleSheet: {create: value => value}},
        '../di/DependenciesContext': {useSupporterNudge: () => f.nudge},
        '../hooks/use-purchases': {usePurchases: () => state},
        '../hooks/use-palette': {usePalette: () => ({colors: new Proxy({}, {get: () => '#123456'})})},
        '../components/themed-text': {ThemedText: 'Text'},
        '../constants/theme': {Radius: {lg: 16, md: 12}, Spacing: {lg: 24, md: 16, sm: 8, xs: 4}},
        './supporter-paywall': {useSupporterPaywall: () => placement => requests.push(placement)},
    });
    let renderer;
    await act(async () => { renderer = create(React.createElement(SupporterDiscoveryCard, {savedCount: options.savedCount ?? 3})); });
    t.after(async () => { await act(async () => renderer.unmount()); });
    return {...f, renderer, requests, buttons: () => renderer.root.findAllByType('Pressable'),
        remount: async () => act(async () => renderer.update(React.createElement(SupporterDiscoveryCard,
            {key: 'remounted', savedCount: options.savedCount ?? 3})))};
}

test('discovery waits for engagement and verified purchasability and excludes subscribers or billing issues', async t => {
    for (const options of [{savedCount: 2}, {state: {ready: false}}, {state: {available: false}},
        {state: {adsRemoved: true}}, {state: {billingIssue: true}}]) {
        const f = await fixture(t, options);
        assert.equal(f.renderer.toJSON(), null);
        assert.deepEqual(f.requests, []);
    }
});

test('eligible discovery opens offers only on an explicit press and carries its own placement', async t => {
    const f = await fixture(t);
    assert.equal(f.buttons().length, 2);
    assert.deepEqual(f.requests, []);
    await act(async () => f.buttons()[0].props.onPress());
    assert.deepEqual(f.requests, ['watchlist_supporter']);
});

test('dismissal survives a new component and service without changing ad-nudge limits', async t => {
    const f = await fixture(t);
    f.nudge.recordAdShown();
    f.nudge.recordAdShown();
    const before = f.values.get('state');
    await act(async () => f.buttons()[1].props.onPress());
    assert.equal(f.renderer.toJSON(), null);
    assert.equal(f.values.get('state'), before);
    assert.deepEqual(f.requests, []);
    const next = await fixture(t, {values: f.values});
    assert.equal(next.renderer.toJSON(), null);
    assert.equal(next.nudge.shouldPrompt(), true);
});

test('unreadable discovery preference suppresses promotion and failed writes do not reopen the card', async t => {
    const f = nudgeFixture();
    f.options.store.getString = () => { throw new Error('storage unavailable'); };
    assert.equal(f.nudge.isDiscoveryDismissed(), true);
    const card = await fixture(t);
    card.options.store.set = () => { throw new Error('storage unavailable'); };
    await act(async () => card.buttons()[1].props.onPress());
    assert.equal(card.renderer.toJSON(), null);
    assert.equal(card.nudge.isDiscoveryDismissed(), true);
    await card.remount();
    assert.equal(card.renderer.toJSON(), null);
    assert.deepEqual(card.requests, []);
});
