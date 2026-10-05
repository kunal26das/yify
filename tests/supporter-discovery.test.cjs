const assert = require('node:assert/strict');
const {test} = require('node:test');
const React = require('react');
const {act, create} = require('react-test-renderer');
const {loadTypeScript} = require('./helpers/load-typescript.cjs');

globalThis.IS_REACT_ACT_ENVIRONMENT = true;
globalThis.requestAnimationFrame = callback => setTimeout(() => callback(Date.now()), 16);
globalThis.cancelAnimationFrame = clearTimeout;
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
    const requests = [], events = [], measurements = [];
    const activity = {focused: true, foreground: true};
    const rectangle = {x: 16, y: 900, width: 328, height: 200};
    const viewport = {x: 0, y: 0, width: 360, height: 800};
    const viewportRef = {current: {measureInWindow: callback => callback(...Object.values(viewport))}};
    const handle = React.createRef();
    const props = {savedCount: options.savedCount ?? 3, topInset: 60, viewportRef, ref: handle};
    let closePaywall, paywallVisible = false, cancellations = 0, remounts = 0;
    const paywallListeners = new Set();
    const setPaywallVisible = value => {
        paywallVisible = value;
        for (const listener of paywallListeners) listener();
    };
    const {SupporterDiscoveryCard} = loadTypeScript('presentation/purchases/supporter-discovery-card.tsx', {
        'react-native': {View: 'View', Pressable: 'Pressable', StyleSheet: {create: value => value},
            useWindowDimensions: () => ({width: 360, height: 800, fontScale: 1})},
        '../di/DependenciesContext': {useSupporterNudge: () => f.nudge},
        '../hooks/use-purchases': {usePurchases: () => state},
        '../hooks/use-palette': {usePalette: () => ({colors: new Proxy({}, {get: () => '#123456'})})},
        '../hooks/use-preferences': {usePreferences: () => ({watchRegion: 'IN'})},
        './use-preview-active': {usePreviewActive: enabled => enabled && activity.focused && activity.foreground},
        '../analytics/events': {Analytics: {subscriptionFunnel: (event, country) => events.push({...event, country})}},
        '../components/themed-text': {ThemedText: 'Text'},
        '../constants/theme': {Radius: {lg: 16, md: 12}, Spacing: {lg: 24, md: 16, sm: 8, xs: 4}},
        './supporter-paywall': {useSupporterPaywallVisible: () => React.useSyncExternalStore(listener => {
            paywallListeners.add(listener);
            return () => paywallListeners.delete(listener);
        }, () => paywallVisible), useSupporterPaywall: () => (placement, onClose) => {
            requests.push(placement);
            setPaywallVisible(true);
            closePaywall = () => { setPaywallVisible(false); onClose(); };
            return () => { cancellations++; setPaywallVisible(false); };
        }},
    });
    let renderer;
    await act(async () => { renderer = create(React.createElement(SupporterDiscoveryCard, props), {
        createNodeMock: node => node.type === 'View' ? {measureInWindow: callback => {
            const values = Object.values(rectangle);
            if (options.deferMeasurements) measurements.push(() => callback(...values));
            else callback(...values);
        }} : null,
    }); });
    t.after(async () => { await act(async () => renderer.unmount()); });
    return {...f, renderer, requests, events, rectangle, viewport, activity, state, measurements,
        paywall: () => ({visible: paywallVisible, cancellations}),
        tick: async milliseconds => act(async () => t.mock.timers.tick(milliseconds)),
        check: async () => act(async () => handle.current.checkVisibility()),
        update: async next => act(async () => renderer.update(React.createElement(SupporterDiscoveryCard, {...props, ...next}))),
        close: async () => act(async () => closePaywall()),
        buttons: () => renderer.root.findAllByType('Pressable'),
        remount: async () => act(async () => renderer.update(React.createElement(SupporterDiscoveryCard,
            {...props, key: ++remounts})))};
}

test('discovery waits for engagement and verified purchasability and excludes subscribers or billing issues', async t => {
    for (const options of [{savedCount: 2}, {state: {ready: false}}, {state: {available: false}},
        {state: {adsRemoved: true}}, {state: {billingIssue: true}}]) {
        const f = await fixture(t, options);
        assert.equal(f.renderer.toJSON(), null);
        assert.deepEqual(f.requests, []);
    }
});

test('discovery measures a continuous second of viewport visibility once per mounted card', async t => {
    t.mock.timers.enable({apis: ['setTimeout', 'Date'], now: 1000});
    const f = await fixture(t);
    await f.tick(2000);
    assert.deepEqual(f.events, []);
    f.rectangle.y = 700;
    await f.check();
    await f.tick(16);
    await f.tick(999);
    assert.deepEqual(f.events, []);
    await f.tick(1);
    await f.tick(16);
    assert.deepEqual(f.events, [{step: 'discovery_view', placement: 'watchlist_supporter', country: 'IN'}]);
    f.rectangle.y = 900;
    await f.check();
    await f.tick(16);
    f.rectangle.y = 200;
    await f.check();
    await f.tick(2016);
    assert.equal(f.events.length, 1);
});

test('brief visibility, covered header, backgrounding and route blur cannot count as an impression', async t => {
    t.mock.timers.enable({apis: ['setTimeout', 'Date'], now: 1000});
    const f = await fixture(t);
    f.rectangle.y = -50;
    await f.check();
    await f.tick(2016);
    assert.deepEqual(f.events, []);
    f.rectangle.y = 200;
    await f.check();
    await f.tick(16);
    await f.tick(600);
    f.rectangle.y = 701;
    await f.check();
    await f.tick(16);
    f.rectangle.y = 200;
    await f.check();
    await f.tick(16);
    await f.tick(600);
    assert.deepEqual(f.events, []);
    for (const key of ['focused', 'foreground']) {
        f.activity[key] = false;
        await f.update();
        await f.tick(2000);
        f.activity[key] = true;
        await f.update();
        await f.tick(16);
        await f.tick(600);
        assert.deepEqual(f.events, []);
    }
    await f.update({obscured: true});
    await f.tick(2000);
    assert.deepEqual(f.events, []);
    await f.update({obscured: false});
    await f.tick(16);
    await f.tick(1000);
    await f.tick(16);
    assert.equal(f.events.filter(event => event.step === 'discovery_view').length, 1);
});

test('quick taps and dismissals remain distinct from measured views and repeated taps do not open two paywalls', async t => {
    t.mock.timers.enable({apis: ['setTimeout', 'Date'], now: 1000});
    const f = await fixture(t);
    f.rectangle.y = 200;
    await f.check();
    await f.tick(16);
    const open = f.buttons()[0].props.onPress;
    await act(async () => {open(); open();});
    await f.tick(2000);
    assert.deepEqual(f.requests, ['watchlist_supporter']);
    assert.deepEqual(f.events.map(event => event.step), ['discovery_opened']);
    await f.close();
    const dismiss = f.buttons()[1].props.onPress;
    await act(async () => {dismiss(); dismiss();});
    await f.tick(2000);
    assert.deepEqual(f.events.map(event => event.step), ['discovery_opened', 'discovery_dismissed']);
});

test('grid remounts preserve the open paywall and suppress discovery behind it until closed', async t => {
    t.mock.timers.enable({apis: ['setTimeout', 'Date'], now: 1000});
    const f = await fixture(t);
    f.rectangle.y = 200;
    await act(async () => f.buttons()[0].props.onPress());
    await f.remount();
    await f.tick(2016);
    assert.deepEqual(f.paywall(), {visible: true, cancellations: 0});
    assert.deepEqual(f.events.map(event => event.step), ['discovery_opened']);
    await act(async () => f.buttons()[0].props.onPress());
    assert.equal(f.requests.length, 1);
    await f.close();
    await f.tick(16);
    await f.tick(1000);
    await f.tick(16);
    assert.deepEqual(f.events.map(event => event.step), ['discovery_opened', 'discovery_view']);
    await act(async () => f.buttons()[0].props.onPress());
    assert.equal(f.requests.length, 2);
});

test('invalid measurements and zero-sized targets never report exposure', async () => {
    const {visibleFraction} = loadTypeScript('presentation/hooks/use-visible-impression.ts', {
        'react-native': {}, './use-preview-active': {},
    });
    const target = {x: 0, y: 0, width: 100, height: 100};
    const viewport = {x: 0, y: 0, width: 100, height: 100};
    assert.equal(visibleFraction(target, viewport, 50), 0.5);
    assert.equal(visibleFraction(target, viewport, 51), 0.49);
    assert.equal(visibleFraction({...target, x: -51}, viewport, 0), 0.49);
    for (const change of [{width: 0}, {height: -1}, {x: NaN}, {y: Infinity}]) {
        assert.equal(visibleFraction({...target, ...change}, viewport, 0), 0);
    }
    assert.equal(visibleFraction(target, {...viewport, height: 0}, 0), 0);
    assert.equal(visibleFraction({...target, x: 60, y: 160}, {...viewport, x: 60, y: 100}, 10), 0.4);
});

test('timer expiry remeasures the card and stale native callbacks after blur cannot count', async t => {
    t.mock.timers.enable({apis: ['setTimeout', 'Date'], now: 1000});
    const f = await fixture(t);
    f.rectangle.y = 200;
    await f.check();
    await f.tick(16);
    f.rectangle.y = 900;
    await f.tick(1000);
    await f.tick(16);
    assert.deepEqual(f.events, []);
    const delayed = await fixture(t, {deferMeasurements: true});
    delayed.rectangle.y = 200;
    await delayed.check();
    await delayed.tick(16);
    assert.ok(delayed.measurements.length > 0);
    delayed.activity.focused = false;
    await delayed.update();
    await act(async () => delayed.measurements.splice(0).forEach(deliver => deliver()));
    await delayed.tick(2000);
    assert.deepEqual(delayed.events, []);
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
