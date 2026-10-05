const assert = require('node:assert/strict');
const {test} = require('node:test');
const React = require('react');
const {act, create} = require('react-test-renderer');
const {loadTypeScript} = require('./helpers/load-typescript.cjs');

globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const {INITIAL_PURCHASE_STATE} = loadTypeScript('domain/entities/Entitlement.ts');
const {billingPeriodLabel, offerDisclosure, supporterStatus, purchaseFailureMessage, safeManagementURL} =
    loadTypeScript('presentation/purchases/offer-copy.ts');
const user = uid => ({uid, name: null, email: null, photoUrl: null});
const plan = (id = 'monthly', offeringId = 'supporter', overrides = {}) => ({
    id, offeringId, title: 'Monthly supporter', priceLabel: '$2.99', recurring: true,
    autoRenewing: true, billingPeriod: 'P1M', placement: 'settings_supporter', ...overrides,
});
const deferred = () => {
    let resolve, reject;
    const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
    return {promise, resolve, reject};
};
function observable(initial) {
    let value = initial;
    const listeners = new Set();
    return {
        get: () => value,
        set: patch => { value = {...value, ...patch}; listeners.forEach(listener => listener()); },
        subscribe: listener => { listeners.add(listener); return () => listeners.delete(listener); },
    };
}
const nodeText = node => typeof node === 'string' ? node : node.children?.map(nodeText).join('') ?? '';
const flattenStyle = style => Object.assign({}, ...[style].flat(Infinity).filter(Boolean));

async function fixture(t, options = {}) {
    const state = observable({...INITIAL_PURCHASE_STATE, available: true, ready: true, ...options.state});
    const session = observable({ready: true, signingIn: false, available: true, account: user('A'), error: null, ...options.session});
    let offers = options.offers ?? [plan()];
    const calls = {offers: [], purchase: [], restore: 0, refresh: 0, signIn: 0, impressions: [], prompts: [], funnel: [], links: [], browsers: []};
    const purchases = {
        getState: state.get,
        subscribe: state.subscribe,
        async getOffers(placement) {
            calls.offers.push(placement);
            return options.getOffers ? options.getOffers(placement) : offers;
        },
        async purchase(id) {
            calls.purchase.push(id);
            return options.purchase ? options.purchase(id) : false;
        },
        async restore() { calls.restore++; return options.restore ? options.restore() : false; },
        async refresh() { calls.refresh++; if (options.refresh) await options.refresh(state); },
        trackPaywallImpression: id => calls.impressions.push(id),
    };
    const auth = {
        getSession: session.get,
        subscribe: session.subscribe,
        async signIn() { calls.signIn++; return options.signIn ? options.signIn(session) : false; },
    };
    const colors = new Proxy({}, {get: () => '#123456'});
    const {SupporterProvider, useSupporterPaywall, useSupporterPaywallVisible} = loadTypeScript('presentation/purchases/supporter-paywall.tsx', {
        'react-native': {
            ActivityIndicator: 'ActivityIndicator', Modal: 'Modal', Pressable: 'Pressable',
            ScrollView: 'ScrollView', View: 'View', Platform: {OS: options.platform ?? 'android'},
            StyleSheet: {create: value => value},
            useWindowDimensions: () => ({height: options.height ?? 800, width: options.width ?? 360, fontScale: options.fontScale ?? 1}),
            Linking: {async openURL(url) { calls.links.push(url); if (options.openURL) await options.openURL(url); }},
        },
        'react-native-safe-area-context': {useSafeAreaInsets: () => ({top: 20, bottom: 10, left: 0, right: 0})},
        'expo-web-browser': {async openBrowserAsync(url, options) { calls.browsers.push({url, options}); return {type: 'opened'}; }},
        '../di/DependenciesContext': {
            usePurchaseRepository: () => purchases, useAuthRepository: () => auth,
            useAdGateway: () => ({supported: true}),
        },
        '../hooks/use-purchases': {usePurchases: () => React.useSyncExternalStore(state.subscribe, state.get)},
        '../hooks/use-auth': {useAuth: () => React.useSyncExternalStore(session.subscribe, session.get)},
        '../hooks/use-palette': {usePalette: () => ({colors})},
        '../hooks/use-preferences': {usePreferences: () => ({watchRegion: options.country ?? 'IN'})},
        '../components/themed-text': {ThemedText: 'Text'},
        '../analytics/events': {Analytics: {subscriptionFunnel: (event, country) => {
            calls.funnel.push({event, country});
            if (event.step === 'paywall_view') calls.prompts.push(event.placement === 'journal_insights' ? 'journal'
                : event.placement === 'settings_supporter' ? 'settings' : 'post_ad');
        }}},
    });
    let show, visible;
    let callerKey = 0;
    function Probe() { show = useSupporterPaywall(); visible = useSupporterPaywallVisible(); return null; }
    const tree = () => React.createElement(SupporterProvider, null, React.createElement(Probe, {key: callerKey}));
    let renderer;
    await act(async () => { renderer = create(tree()); });
    t.after(async () => { await act(async () => { renderer.unmount(); }); });
    const open = async (placement = 'settings_supporter', onClose) => {
        let cancel;
        await act(async () => { cancel = show(placement, onClose); });
        return cancel;
    };
    const modal = () => renderer.root.findByType('Modal');
    const pressable = label => renderer.root.findAllByType('Pressable').find(node =>
        node.props.accessibilityLabel === label || nodeText(node) === label);
    const press = async label => {
        const button = pressable(label);
        assert.ok(button, `button ${label} exists`);
        assert.equal(Boolean(button.props.disabled), false, `button ${label} is enabled`);
        await act(async () => { button.props.onPress(); });
    };
    return {
        renderer, state, session, calls, purchases, open, modal, press, pressable,
        visible: () => visible,
        remountCaller: () => act(async () => {callerKey++; renderer.update(tree());}),
        show: () => act(async () => { modal().props.onShow(); }),
        text: () => renderer.root.findAllByType('Text').map(nodeText).join('\n'),
        update: async (patch, authPatch) => act(async () => {
            if (patch) state.set(patch);
            if (authPatch) session.set(authPatch);
        }),
        setOffers: next => { offers = next; },
    };
}

test('billing copy uses actual monthly, annual, multi-month, prepaid, and one-time terms', () => {
    assert.equal(offerDisclosure(plan()), '$2.99 every month. Renews automatically until cancelled.');
    assert.equal(offerDisclosure(plan('annual', 'supporter', {billingPeriod: 'P1Y'})), '$2.99 every year. Renews automatically until cancelled.');
    assert.equal(offerDisclosure(plan('quarterly', 'supporter', {billingPeriod: 'P3M'})), '$2.99 every 3 months. Renews automatically until cancelled.');
    assert.equal(offerDisclosure(plan('prepaid', 'supporter', {autoRenewing: false})), '$2.99 for 1 month. Prepaid access; does not renew automatically.');
    assert.equal(offerDisclosure(plan('once', 'supporter', {recurring: false})), '$2.99 once. No renewal.');
    assert.equal(offerDisclosure(plan('unknown', 'supporter', {billingPeriod: null})), '$2.99 per billing period. Renews automatically until cancelled.');
    for (const period of ['P0M', 'P-1M', 'P1Q', 'P999999999999999999999M', null]) assert.equal(billingPeriodLabel(period), null);
});

test('status distinguishes active renewal, cancelled access, lapsed access and payment issues', () => {
    const future = '2035-01-15T00:00:00Z';
    const date = new Date(future).toLocaleDateString();
    assert.equal(supporterStatus({...INITIAL_PURCHASE_STATE, adsRemoved: true, expiresAt: future, willRenew: true}), `Your support renews on ${date}.`);
    assert.equal(supporterStatus({...INITIAL_PURCHASE_STATE, adsRemoved: true, expiresAt: future}), `Your access continues until ${date}.`);
    assert.match(supporterStatus({...INITIAL_PURCHASE_STATE, expiresAt: '2020-01-01T00:00:00Z'}), /access ended on/);
    assert.match(supporterStatus({...INITIAL_PURCHASE_STATE, billingIssue: true}), /payment issue/);
    assert.match(supporterStatus({...INITIAL_PURCHASE_STATE, adsRemoved: true, expiresAt: 'invalid'}), /access is active/);
    assert.doesNotMatch(supporterStatus({...INITIAL_PURCHASE_STATE, adsRemoved: false, expiresAt: 'invalid'}), /access is active/);
});

test('billing links only accept HTTPS without embedded credentials; failure copy avoids another charge', () => {
    assert.equal(safeManagementURL('https://billing.example.test/manage?id=1'), 'https://billing.example.test/manage?id=1');
    for (const url of ['javascript:alert(1)', 'http://billing.example.test', 'https://user:secret@billing.example.test', 'not a url', null]) {
        assert.equal(safeManagementURL(url), null);
    }
    assert.equal(purchaseFailureMessage('cancelled'), null);
    assert.match(purchaseFailureMessage('pending'), /do not need to pay again/);
    assert.match(purchaseFailureMessage('not_granted'), /do not need to pay again/);
});

test('impressions wait for the visible modal and loaded plans, then dedupe by offering across reordering', async t => {
    const loading = deferred();
    let initial = true;
    const f = await fixture(t, {getOffers: () => initial ? loading.promise : [plan('annual'), plan('monthly')]});
    await f.open();
    assert.deepEqual(f.calls.impressions, []);
    await f.show();
    assert.deepEqual(f.calls.impressions, []);
    await act(async () => { loading.resolve([plan('monthly'), plan('annual')]); });
    assert.deepEqual(f.calls.impressions, ['monthly']);
    await f.show();
    assert.deepEqual(f.calls.prompts, ['settings']);
    initial = false;
    await f.press('Reload plans');
    assert.deepEqual(f.calls.impressions, ['monthly']);
});

test('each offering is attributed once and an excluded placement has no impression or purchase button', async t => {
    const f = await fixture(t, {offers: [plan('one', 'one-offering'), plan('two', 'two-offering')]});
    await f.open('post_ad_supporter');
    await f.show();
    assert.deepEqual(f.calls.impressions, ['one', 'two']);
    assert.deepEqual(f.calls.prompts, ['post_ad']);
    f.setOffers([]);
    await f.press('Reload plans');
    assert.match(f.text(), /plans are unavailable/);
    assert.equal(f.pressable('Continue · $2.99'), undefined);
    assert.deepEqual(f.calls.impressions, ['one', 'two']);
});

test('Journal paywall keeps its placement for loading, visibility and purchase while preserving sign-in gating', async t => {
    const journal = plan('journal-monthly', 'supporter', {placement: 'journal_insights'});
    const f = await fixture(t, {offers: [journal], session: {account: null}});
    await f.open('journal_insights');
    await f.show();
    assert.deepEqual(f.calls.offers, ['journal_insights']);
    assert.deepEqual(f.calls.prompts, ['journal']);
    assert.deepEqual(f.calls.impressions, ['journal-monthly']);
    assert.equal(f.calls.funnel.every(({event}) => event.placement === 'journal_insights'), true);
    assert.equal(f.pressable('Continue · $2.99'), undefined);
    assert.deepEqual(f.calls.purchase, []);
    await f.update(null, {account: user('A')});
    await f.show();
    await f.press('Continue · $2.99');
    assert.deepEqual(f.calls.purchase, ['journal-monthly']);
    assert.equal(f.calls.offers.every(placement => placement === 'journal_insights'), true);
});

test('benefits and a labelled fictional example precede localized pricing and the single anonymous sign-in action', async t => {
    const f = await fixture(t, {offers: [plan('monthly-in', 'supporter', {priceLabel: '₹99.00'})], session: {account: null}});
    await f.open();
    const content = f.text();
    assert.match(content, /No Yify ads \+ viewing insights/);
    assert.match(content, /monthly and all-time recaps/);
    assert.match(content, /Fictional journal · one month/);
    assert.match(content, /Your insights use the movies and ratings you add to your journal/);
    assert.match(content, /Your journal entries and editing stay free/);
    assert.match(content, /YouTube ads are separate/);
    assert.match(content, /₹99\.00 every month\. Renews automatically until cancelled/);
    assert.ok(content.indexOf('Example insights') < content.indexOf('₹99.00 every month'));
    assert.ok(content.indexOf('₹99.00 every month') < content.indexOf('Sign in with Google'));
    assert.match(content, /Signing in does not start a subscription/);
    assert.equal(f.pressable('Continue · ₹99.00'), undefined);
    assert.equal(f.pressable('Restore purchases'), undefined);
    assert.equal(f.renderer.root.findAllByType('Pressable').filter(node => nodeText(node) === 'Sign in with Google').length, 1);
    assert.deepEqual(f.calls.purchase, []);
    assert.deepEqual(f.calls.impressions, []);
    assert.deepEqual(f.calls.funnel, []);
    assert.equal(f.renderer.root.findAllByProps({accessibilityLabel: 'Average rating: 4.2 / 5'}).length, 1);
    await f.update({adsRemoved: true});
    assert.doesNotMatch(f.text(), /Example insights|Fictional journal|No Yify ads \+ viewing insights/);
    assert.equal(f.pressable('Continue · ₹99.00'), undefined);
});

test('active access shows manage and restore actions without recording a sales impression', async t => {
    const f = await fixture(t, {state: {
        adsRemoved: true, managementURL: 'https://billing.example.test/manage',
        expiresAt: '2035-01-15T00:00:00Z', willRenew: false,
    }});
    await f.open();
    await f.show();
    assert.match(f.text(), /access continues until/);
    assert.equal(f.pressable('Continue · $2.99'), undefined);
    assert.deepEqual(f.calls.impressions, []);
    assert.equal(f.calls.funnel.some(({event}) => event.step === 'offers_visible'), false);
    assert.equal(f.calls.funnel.find(({event}) => event.step === 'paywall_view').event.supporter, true);
    await f.press('Manage billing or cancel');
    assert.deepEqual(f.calls.links, ['https://billing.example.test/manage']);
    assert.ok(f.pressable('Restore purchases'));
});

test('Android legal links open our hosted pages in custom tabs and invalid management URLs are not rendered', async t => {
    const f = await fixture(t, {state: {managementURL: 'javascript:alert(1)'}});
    await f.open();
    assert.equal(f.pressable('Manage billing or cancel'), undefined);
    await f.press('Privacy policy');
    await f.press('Terms and conditions');
    assert.deepEqual(f.calls.browsers, [
        {url: 'https://yify.expo.app/privacy/', options: {enableBarCollapsing: true}},
        {url: 'https://yify.expo.app/terms/', options: {enableBarCollapsing: true}},
    ]);
    assert.deepEqual(f.calls.links, []);
    assert.equal(f.pressable('Privacy policy').props.accessibilityRole, 'link');
    assert.equal(f.pressable('Terms and conditions').props.accessibilityRole, 'link');
});

test('web legal links use the browser without changing custom-tab behavior on Android', async t => {
    const f = await fixture(t, {platform: 'web'});
    await f.open();
    await f.press('Privacy policy');
    await f.press('Terms and conditions');
    assert.deepEqual(f.calls.links, ['https://yify.expo.app/privacy/', 'https://yify.expo.app/terms/']);
    assert.deepEqual(f.calls.browsers, []);
});

test('restore reports a recovered purchase and distinguishes web account checks from mobile restoration', async t => {
    const mobile = await fixture(t, {restore: async () => true});
    await mobile.open();
    await mobile.press('Restore purchases');
    assert.equal(mobile.calls.restore, 1);
    assert.match(mobile.text(), /Your supporter access is active/);
    const web = await fixture(t, {platform: 'web'});
    await web.open();
    await web.press('Check account purchases');
    assert.match(web.text(), /restore in the mobile app/);
});

test('unready services offer a working retry instead of an endless loading indicator', async t => {
    const f = await fixture(t, {state: {ready: false}, refresh: async state => state.set({ready: true})});
    await f.open();
    assert.match(f.text(), /not connected yet/);
    assert.equal(f.renderer.root.findAllByType('ActivityIndicator').length, 0);
    assert.equal(f.pressable('Restore purchases').props.disabled, true);
    await f.press('Refresh access');
    assert.equal(f.calls.refresh, 1);
    assert.ok(f.pressable('Continue · $2.99'));
});

test('missing purchase configuration clearly disables retry and checkout', async t => {
    const f = await fixture(t, {state: {ready: false, available: false}});
    await f.open();
    assert.match(f.text(), /Purchases are unavailable/);
    assert.equal(f.pressable('Refresh access').props.disabled, true);
    assert.equal(f.pressable('Restore purchases').props.disabled, true);
    assert.equal(f.pressable('Continue · $2.99'), undefined);
});

test('sign-in gates purchases and reports rejected sign-in without an unhandled promise', async t => {
    const f = await fixture(t, {session: {account: null}, signIn: async () => { throw Error('offline'); }});
    await f.open();
    assert.equal(f.pressable('Continue · $2.99'), undefined);
    assert.equal(f.pressable('Restore purchases'), undefined);
    await f.press('Sign in with Google');
    assert.equal(f.calls.signIn, 1);
    assert.match(f.text(), /Sign-in could not be completed/);
    assert.deepEqual(f.calls.funnel.filter(({event}) => event.step.startsWith('sign_in')), [
        {event: {step: 'sign_in_started', placement: 'settings_supporter'}, country: 'IN'},
        {event: {step: 'sign_in_finished', placement: 'settings_supporter', outcome: 'failed'}, country: 'IN'},
    ]);
});

test('anonymous users can compare multiple localized plans without any checkout action before signing in', async t => {
    const f = await fixture(t, {session: {account: null}, offers: [
        plan('monthly', 'supporter', {priceLabel: '€2,99'}),
        plan('annual', 'supporter', {title: 'Annual supporter', priceLabel: '€29,99', billingPeriod: 'P1Y'}),
    ]});
    await f.open();
    assert.match(f.text(), /€2,99 every month\. Renews automatically until cancelled/);
    assert.match(f.text(), /€29,99 every year\. Renews automatically until cancelled/);
    assert.match(f.text(), /Manage or cancel a subscription in the store where you paid/);
    assert.equal(f.renderer.root.findAllByType('Pressable').some(node => nodeText(node).startsWith('Continue ·')), false);
    assert.equal(f.calls.signIn, 0);
    assert.deepEqual(f.calls.purchase, []);
});

test('an accepted sign-in attempt finishes once across account remounts and never starts a purchase', async t => {
    const pending = deferred();
    const f = await fixture(t, {session: {account: null}, signIn: session => {
        session.set({signingIn: true, error: null});
        return pending.promise;
    }});
    await f.open('journal_insights');
    const signIn = f.pressable('Sign in with Google').props.onPress;
    await act(async () => {signIn(); signIn();});
    assert.equal(f.calls.signIn, 1);
    assert.equal(f.pressable('Close supporter options').props.disabled, true);
    f.setOffers([plan('signed-in-monthly', 'supporter', {priceLabel: '₹89.00'})]);
    await f.update(null, {account: user('B'), signingIn: false});
    assert.equal(f.pressable('Continue · ₹89.00').props.disabled, true);
    assert.deepEqual(f.calls.purchase, []);
    await act(async () => pending.resolve(true));
    assert.equal(f.pressable('Continue · ₹89.00').props.disabled, false);
    await act(async () => signIn());
    assert.equal(f.calls.signIn, 1);
    assert.deepEqual(f.calls.funnel.filter(({event}) => event.step.startsWith('sign_in')), [
        {event: {step: 'sign_in_started', placement: 'journal_insights'}, country: 'IN'},
        {event: {step: 'sign_in_finished', placement: 'journal_insights', outcome: 'signed_in'}, country: 'IN'},
    ]);
    assert.deepEqual(f.calls.purchase, []);
    await f.press('Continue · ₹89.00');
    assert.deepEqual(f.calls.purchase, ['signed-in-monthly']);
});

test('cancelled sign-in and repository failures remain distinct and each explicit retry records one attempt', async t => {
    let attempt = 0;
    const f = await fixture(t, {session: {account: null}, signIn: session => {
        attempt++;
        session.set({signingIn: false, error: attempt === 1 ? null : 'auth/private-error-code'});
        return false;
    }});
    await f.open();
    await f.press('Sign in with Google');
    assert.match(f.text(), /Sign-in was cancelled\. No purchase was made/);
    await f.press('Sign in with Google');
    assert.match(f.text(), /Sign-in could not be completed/);
    assert.doesNotMatch(f.text(), /private-error-code/);
    assert.deepEqual(f.calls.funnel.filter(({event}) => event.step.startsWith('sign_in')).map(({event}) => event), [
        {step: 'sign_in_started', placement: 'settings_supporter'},
        {step: 'sign_in_finished', placement: 'settings_supporter', outcome: 'cancelled'},
        {step: 'sign_in_started', placement: 'settings_supporter'},
        {step: 'sign_in_finished', placement: 'settings_supporter', outcome: 'failed'},
    ]);
    assert.deepEqual(f.calls.purchase, []);
});

test('web redirect acceptance without an account remains pending instead of reporting a sign-in conversion', async t => {
    const f = await fixture(t, {platform: 'web', session: {account: null}, signIn: session => {
        session.set({signingIn: true, error: null});
        return true;
    }});
    await f.open();
    await f.press('Sign in with Google');
    assert.deepEqual(f.calls.funnel, [
        {event: {step: 'sign_in_started', placement: 'settings_supporter'}, country: 'IN'},
    ]);
    assert.equal(f.pressable('Signing in…').props.disabled, true);
    assert.deepEqual(f.calls.purchase, []);
});

test('session restoration and access refresh do not masquerade as paywall sign-in attempts', async t => {
    const f = await fixture(t, {session: {account: null}});
    await f.open();
    await f.update(null, {account: user('restored')});
    await f.press('Refresh access');
    await f.press('Restore purchases');
    assert.equal(f.calls.signIn, 0);
    assert.deepEqual(f.calls.funnel.filter(({event}) => event.step.startsWith('sign_in')), []);
    assert.deepEqual(f.calls.purchase, []);
});

test('pending payments are visible and a failed restore provides recovery copy', async t => {
    const f = await fixture(t, {state: {failure: 'pending'}, restore: async () => { throw Error('offline'); }});
    await f.open();
    assert.match(f.text(), /do not need to pay again/);
    await f.press('Restore purchases');
    assert.match(f.text(), /could not restore purchases/);
    assert.ok(f.renderer.root.findAllByType('Text').some(node => node.props.accessibilityLiveRegion === 'polite'));
});

test('repeated purchase taps make one request and close waits for it to settle', async t => {
    const pending = deferred();
    const closed = [];
    const f = await fixture(t, {purchase: () => pending.promise});
    await f.open('settings_supporter', result => closed.push(result));
    const buy = f.pressable('Continue · $2.99').props.onPress;
    const close = f.modal().props.onRequestClose;
    await act(async () => { buy(); buy(); close(); });
    assert.deepEqual(f.calls.purchase, ['monthly']);
    assert.deepEqual(closed, []);
    await act(async () => { pending.resolve(true); });
    assert.match(f.text(), /Thank you for supporting/);
    await f.update({adsRemoved: true});
    await f.press('Close supporter options');
    assert.deepEqual(closed, [true]);
});

test('changing accounts drops old asynchronous purchase notices and starts a fresh exposure', async t => {
    const pending = deferred();
    const f = await fixture(t, {purchase: () => pending.promise});
    await f.open();
    await f.show();
    await f.press('Continue · $2.99');
    f.setOffers([plan('B-monthly')]);
    await f.update({ready: true, adsRemoved: false}, {account: user('B')});
    await f.show();
    await act(async () => { pending.resolve(true); });
    assert.doesNotMatch(f.text(), /Thank you for supporting/);
    assert.deepEqual(f.calls.impressions, ['monthly', 'B-monthly']);
});

test('late offer results from a previous identity cannot replace the current account plans', async t => {
    const pending = deferred();
    let usePending = true;
    const f = await fixture(t, {getOffers: () => usePending ? pending.promise : [plan('B', 'B-offering', {title: 'B plan'})]});
    await f.open();
    usePending = false;
    await f.update(null, {account: user('B')});
    await act(async () => { pending.resolve([plan('A', 'A-offering', {title: 'A plan'})]); });
    assert.match(f.text(), /B plan/);
    assert.doesNotMatch(f.text(), /A plan/);
});

test('overlapping paywall requests preserve both callbacks and old close handlers cannot dismiss the next', async t => {
    const closed = [];
    const f = await fixture(t);
    await f.open('settings_supporter', result => closed.push(['first', result]));
    const oldClose = f.modal().props.onRequestClose;
    await f.open('settings_supporter', result => closed.push(['second', result]));
    await act(async () => { oldClose(); oldClose(); });
    assert.deepEqual(closed, [['first', false]]);
    assert.equal(f.renderer.root.findAllByType('Modal').length, 1);
    await f.press('Close supporter options');
    assert.deepEqual(closed, [['first', false], ['second', false]]);
    assert.equal(f.renderer.root.findAllByType('Modal').length, 0);
});

test('provider visibility survives caller remounts and stays active until the final queued paywall closes', async t => {
    const f = await fixture(t);
    assert.equal(f.visible(), false);
    await f.open();
    await f.show();
    assert.equal(f.visible(), true);
    const originalModal = f.modal();
    await f.remountCaller();
    assert.equal(f.visible(), true);
    assert.equal(f.modal(), originalModal);
    assert.deepEqual(f.calls.offers, ['settings_supporter']);
    await f.open('journal_insights');
    await f.press('Close supporter options');
    assert.equal(f.visible(), true);
    await f.press('Close supporter options');
    assert.equal(f.visible(), false);
});

test('cancelling queued or active requests clears provider visibility only after no paywall remains', async t => {
    const f = await fixture(t);
    const cancelActive = await f.open();
    const cancelQueued = await f.open('journal_insights');
    await act(async () => cancelQueued());
    assert.equal(f.visible(), true);
    await act(async () => cancelActive());
    assert.equal(f.visible(), false);
});

test('cancelling a queued owner removes only its request and never invokes its completion callback', async t => {
    const closed = [];
    const f = await fixture(t);
    await f.open('settings_supporter', result => closed.push(['first', result]));
    const cancel = await f.open('supporter_page', result => closed.push(['cancelled', result]));
    await f.open('journal_insights', result => closed.push(['last', result]));
    await act(async () => { cancel(); cancel(); });
    await f.press('Close supporter options');
    assert.deepEqual(closed, [['first', false]]);
    assert.deepEqual(f.calls.offers, ['settings_supporter', 'journal_insights']);
    await act(async () => cancel());
    await f.press('Close supporter options');
    assert.deepEqual(closed, [['first', false], ['last', false]]);
});

test('cancelling an idle active owner closes silently and ignores stale visibility callbacks', async t => {
    const closed = [];
    const f = await fixture(t);
    const cancel = await f.open('supporter_page', value => closed.push(value));
    const oldShow = f.modal().props.onShow;
    const oldClose = f.modal().props.onRequestClose;
    await act(async () => { cancel(); oldShow(); oldClose(); });
    assert.equal(f.renderer.root.findAllByType('Modal').length, 0);
    assert.deepEqual(closed, []);
    assert.deepEqual(f.calls.funnel, []);
    assert.deepEqual(f.calls.impressions, []);
});

for (const action of ['purchase', 'restore', 'signIn']) {
    test(`owner cancellation waits for ${action}, including an account change, before advancing the queue`, async t => {
        const pending = deferred();
        const closed = [];
        const f = await fixture(t, {[action]: () => pending.promise,
            ...(action === 'signIn' ? {session: {account: null}} : {})});
        const cancel = await f.open('supporter_page', value => closed.push(['cancelled', value]));
        await f.press(action === 'purchase' ? 'Continue · $2.99'
            : action === 'restore' ? 'Restore purchases' : 'Sign in with Google');
        await act(async () => cancel());
        await f.open('journal_insights', value => closed.push(['next', value]));
        await f.update(null, {account: user('B')});
        assert.equal(f.visible(), true);
        assert.equal(f.renderer.root.findAllByType('Modal').length, 1);
        assert.equal(f.pressable('Close supporter options').props.disabled, true);
        assert.equal(f.calls.offers.includes('journal_insights'), false);
        await act(async () => pending.resolve(true));
        assert.equal(f.renderer.root.findAllByType('Modal').length, 1);
        assert.equal(f.calls.offers.includes('journal_insights'), true);
        assert.deepEqual(closed, []);
        await f.press('Close supporter options');
        assert.deepEqual(closed, [['next', false]]);
        assert.equal(f.visible(), false);
    });
}

test('small windows bound the scrolling content and retain an accessible close control outside it', async t => {
    const f = await fixture(t, {height: 320});
    await f.open();
    const panel = f.renderer.root.findAllByType('View').find(node => node.props.accessibilityViewIsModal);
    assert.equal(flattenStyle(panel.props.style).maxHeight, 258);
    assert.equal(typeof panel.props.onAccessibilityEscape, 'function');
    const scroll = f.renderer.root.findByType('ScrollView');
    assert.equal(flattenStyle(scroll.props.style).flexShrink, 1);
    assert.equal(flattenStyle(scroll.props.style).minHeight, 0);
    assert.equal(scroll.findAllByProps({accessibilityLabel: 'Close supporter options'}).length, 0);
    const close = f.pressable('Close supporter options');
    assert.ok(flattenStyle(close.props.style).minHeight >= 44);
    assert.equal(f.renderer.root.findAllByProps({accessibilityRole: 'header'}).length, 1);
});

test('large text on narrow screens puts the title inside the scroll while keeping Close independently reachable', async t => {
    const f = await fixture(t, {width: 320, height: 568, fontScale: 2});
    await f.open();
    const scroll = f.renderer.root.findByType('ScrollView');
    const headings = scroll.findAllByProps({accessibilityRole: 'header'});
    assert.equal(headings.length, 1);
    assert.equal(nodeText(headings[0]), 'Yify Supporter');
    assert.equal(flattenStyle(headings[0].props.style).flex, undefined);
    assert.equal(scroll.findAllByProps({accessibilityLabel: 'Close supporter options'}).length, 0);
    await f.press('Close supporter options');
    assert.equal(f.renderer.root.findAllByType('Modal').length, 0);
});

test('paywall funnel measures actual visibility, ready offers and one explicit close with viewing country', async t => {
    const loading = deferred();
    const f = await fixture(t, {country: 'GB', getOffers: () => loading.promise});
    await f.open('post_ad_supporter');
    assert.deepEqual(f.calls.funnel, []);
    await f.show();
    await f.show();
    assert.deepEqual(f.calls.funnel, [{event: {
        step: 'paywall_view', placement: 'post_ad_supporter', signedIn: true, supporter: false,
    }, country: 'GB'}]);
    await act(async () => loading.resolve([plan()]));
    await f.press('Reload plans');
    assert.equal(f.calls.funnel.filter(({event}) => event.step === 'offers_visible').length, 1);
    const close = f.pressable('Close supporter options').props.onPress;
    await act(async () => {close(); close();});
    assert.equal(f.calls.funnel.filter(({event}) => event.step === 'paywall_closed').length, 1);
    assert.equal(f.calls.funnel.every(({country}) => country === 'GB'), true);
});
