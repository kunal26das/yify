const assert = require('node:assert/strict');
const {test, beforeEach, afterEach} = require('node:test');
const {loadTypeScript} = require('./helpers/load-typescript.cjs');

const originalWindow = global.window;
const originalDocument = global.document;
beforeEach(() => { global.window = {addEventListener() {}}; });
afterEach(() => {
    if (originalWindow === undefined) delete global.window;
    else global.window = originalWindow;
    if (originalDocument === undefined) delete global.document;
    else global.document = originalDocument;
});

const account = uid => ({uid, name: null, email: null, photoUrl: null});
const cacheKey = uid => `ads_removed:v2:${encodeURIComponent(uid)}`;
const grantedInfo = (granted = false, overrides = {}) => ({
    entitlements: {active: granted ? {remove_ads: {
        expirationDate: null, willRenew: false, billingIssueDetectedAt: null,
        ...overrides,
    }} : {}},
    managementURL: granted ? 'https://billing.example.test/manage' : null,
});
const pkg = (identifier = '$rc_lifetime', title = 'Ad-free') => ({
    identifier,
    webBillingProduct: {
        title, currentPrice: {formattedPrice: '$9.99'},
        productType: 'NonConsumable', normalPeriodDuration: null,
    },
});
const offering = (identifier = 'default', packages = [pkg()]) => ({identifier, availablePackages: packages});
const deferred = () => {
    let resolve, reject;
    const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
    return {promise, resolve, reject};
};
const tick = () => new Promise(resolve => setImmediate(resolve));

function fixture({values = new Map(), overrides = {}, apiKey = 'rcb_public_test_key'} = {}) {
    const calls = [];
    const events = [];
    const properties = [];
    let generated = 0;
    const store = {
        getString: key => values.get(key),
        set: (key, value) => values.set(key, value),
        delete: key => values.delete(key),
    };
    const sdk = {
        userId: null,
        getAppUserId() { return this.userId; },
        isAnonymous() { return this.userId.startsWith('$RCAnonymousID:'); },
        async getCustomerInfo() {
            const uid = this.userId;
            calls.push({method: 'info', uid});
            return overrides.info ? overrides.info(uid) : grantedInfo();
        },
        async changeUser(uid) {
            calls.push({method: 'change', uid});
            this.userId = uid;
            return overrides.change ? overrides.change(uid) : grantedInfo();
        },
        async identifyUser(uid) {
            calls.push({method: 'identify', uid, from: this.userId});
            const customerInfo = overrides.identify ? await overrides.identify(uid) : grantedInfo();
            this.userId = uid;
            return {customerInfo, wasCreated: true};
        },
        async getCurrentOfferingForPlacement(placement) {
            calls.push({method: 'offers', placement, uid: this.userId});
            return overrides.offers ? overrides.offers(placement, this.userId) : offering();
        },
        async purchase(params) {
            calls.push({method: 'purchase', params, uid: this.userId});
            return overrides.purchase ? overrides.purchase(params, this.userId) : {customerInfo: grantedInfo(true)};
        },
        trackCustomPaywallImpression(params) {
            calls.push({method: 'impression', params, uid: this.userId});
            if (overrides.impression) overrides.impression(params);
        },
    };
    class PurchasesError extends Error {
        constructor(errorCode) { super('private checkout details'); this.errorCode = errorCode; }
    }
    const previousKey = process.env.EXPO_PUBLIC_REVENUECAT_WEB_KEY;
    if (apiKey) process.env.EXPO_PUBLIC_REVENUECAT_WEB_KEY = apiKey;
    else delete process.env.EXPO_PUBLIC_REVENUECAT_WEB_KEY;
    const {RevenueCatPurchaseRepositoryImpl} = loadTypeScript('data/repositories/RevenueCatPurchaseRepositoryImpl.web.ts', {
        '@revenuecat/purchases-js': {
            ErrorCode: {UserCancelledError: 1, ProductAlreadyPurchasedError: 6, PaymentPendingError: 20},
            ProductType: {Subscription: 'Subscription'},
            PurchasesError,
            Purchases: {
                configure(options) {
                    calls.push({method: 'configure', options});
                    sdk.userId = options.appUserId;
                    return sdk;
                },
                generateRevenueCatAnonymousAppUserId: () => `$RCAnonymousID:generated${++generated}`,
            },
        },
    });
    if (previousKey === undefined) delete process.env.EXPO_PUBLIC_REVENUECAT_WEB_KEY;
    else process.env.EXPO_PUBLIC_REVENUECAT_WEB_KEY = previousKey;
    const repository = new RevenueCatPurchaseRepositoryImpl({
        trackEvent: (name, params) => events.push({name, params}),
        setUserProperty: (name, value) => properties.push({name, value}),
    }, store);
    return {repository, calls, events, properties, values, sdk, PurchasesError};
}

const selectedOffer = repository => repository.getState().offers[0].id;

test('web initialization waits for resolved auth and configures once across concurrent callers', async () => {
    const f = fixture();
    await Promise.all([f.repository.init(), f.repository.init()]);
    assert.equal(f.repository.getState().ready, false);
    assert.deepEqual(f.calls, []);
    await Promise.all([f.repository.identify(null), f.repository.init(), f.repository.init()]);
    assert.equal(f.calls.filter(call => call.method === 'configure').length, 1);
    assert.equal(f.calls.filter(call => call.method === 'info').length, 1);
    assert.equal(f.repository.getState().ready, true);
});

test('late anonymous initialization cannot overwrite a newer account and obsolete logins are skipped', async () => {
    const info = deferred();
    const f = fixture({overrides: {info: () => info.promise}});
    const snapshots = [];
    f.repository.subscribe(() => snapshots.push(f.repository.getState()));
    const initial = f.repository.identify(null);
    await tick();
    const a = f.repository.identify(account('A'));
    const b = f.repository.identify(account('B'));
    assert.equal(f.calls.some(call => call.method === 'identify'), false);
    info.resolve(grantedInfo(true));
    await Promise.all([initial, a, b]);
    assert.deepEqual(f.calls.filter(call => call.method === 'identify').map(call => call.uid), ['B']);
    assert.equal(f.sdk.userId, 'B');
    assert.equal(f.repository.getState().adsRemoved, false);
    assert.equal(snapshots.some(state => state.adsRemoved), false);
    assert.equal(f.values.has(cacheKey('$RCAnonymousID:generated1')), false);
});

test('anonymous purchases are linked on login and sign-out uses a fresh persisted identity', async () => {
    const values = new Map([['app_user_id', '$RCAnonymousID:original']]);
    const f = fixture({values, overrides: {
        info: uid => grantedInfo(uid === '$RCAnonymousID:original'),
        identify: () => grantedInfo(true),
    }});
    await f.repository.identify(null);
    assert.equal(f.repository.getState().adsRemoved, true);
    await f.repository.identify(account('A'));
    assert.deepEqual(f.calls.find(call => call.method === 'identify'), {
        method: 'identify', uid: 'A', from: '$RCAnonymousID:original',
    });
    assert.notEqual(values.get('app_user_id'), '$RCAnonymousID:original');
    await f.repository.identify(null);
    assert.equal(f.sdk.userId, values.get('app_user_id'));
    assert.equal(f.repository.getState().adsRemoved, false);
    const newAnonymous = f.sdk.userId;
    await f.repository.identify(null);
    assert.equal(f.sdk.userId, newAnonymous);
    const reload = fixture({values});
    await reload.repository.identify(null);
    assert.equal(reload.sdk.userId, newAnonymous);
    assert.equal(reload.repository.getState().adsRemoved, false);
});

test('unscoped and other-account cached grants are never applied; verified revocations are persisted', async () => {
    const values = new Map([
        ['ads_removed', 'true'],
        [cacheKey('A'), JSON.stringify({adsRemoved: true, expiresAt: null})],
    ]);
    const f = fixture({values});
    assert.equal(f.repository.getState().adsRemoved, false);
    await f.repository.identify(account('B'));
    assert.equal(f.repository.getState().adsRemoved, false);
    const pending = f.repository.identify(account('A'));
    assert.equal(f.repository.getState().adsRemoved, true);
    assert.equal(f.repository.getState().ready, false);
    await pending;
    assert.equal(f.repository.getState().adsRemoved, false);
    assert.deepEqual(JSON.parse(values.get(cacheKey('A'))), {adsRemoved: false, expiresAt: null});
});

test('expired or malformed cached subscription grants do not unlock benefits', async () => {
    for (const expiresAt of ['2020-01-01T00:00:00.000Z', 'invalid', undefined]) {
        const f = fixture({values: new Map([[cacheKey('A'), JSON.stringify({adsRemoved: true, expiresAt})]])});
        const identifying = f.repository.identify(account('A'));
        assert.equal(f.repository.getState().adsRemoved, false);
        await identifying;
    }
});

test('failed customer fetch can retry without configuring a second SDK instance', async () => {
    let fail = true;
    const f = fixture({overrides: {info: () => {
        if (fail) throw Error('offline');
        return grantedInfo(true);
    }}});
    await f.repository.identify(null);
    assert.equal(f.repository.getState().ready, false);
    fail = false;
    await f.repository.init();
    assert.equal(f.repository.getState().ready, true);
    assert.equal(f.repository.getState().adsRemoved, true);
    assert.equal(f.calls.filter(call => call.method === 'configure').length, 1);
});

test('failed account change hides old grants until refresh confirms the requested identity', async () => {
    let fail = true;
    const f = fixture({overrides: {
        identify: () => grantedInfo(true),
        change: () => { if (fail) throw Error('offline after SDK user replacement'); return grantedInfo(); },
        info: () => grantedInfo(),
    }});
    await f.repository.identify(account('A'));
    assert.equal(f.repository.getState().adsRemoved, true);
    await f.repository.identify(account('B'));
    assert.equal(f.repository.getState().ready, false);
    assert.equal(f.repository.getState().adsRemoved, false);
    assert.equal(await f.repository.purchase('old-offer'), false);
    fail = false;
    await f.repository.refresh();
    assert.equal(f.repository.getState().ready, true);
    assert.equal(f.sdk.userId, 'B');
    assert.equal(f.repository.getState().adsRemoved, false);
});

test('duplicate checkout shares a single purchase and account changes wait without accepting its stale grant', async () => {
    const checkout = deferred();
    const f = fixture({overrides: {purchase: () => checkout.promise}});
    await f.repository.identify(account('A'));
    const id = selectedOffer(f.repository);
    const first = f.repository.purchase(id);
    const second = f.repository.purchase(id);
    assert.equal(await f.repository.purchase('different'), false);
    assert.equal(await f.repository.restore(), false);
    await tick();
    const switchAccount = f.repository.identify(account('B'));
    assert.equal(f.repository.getState().purchasing, null);
    assert.equal(f.repository.getState().ready, false);
    assert.equal(f.sdk.userId, 'A');
    checkout.resolve({customerInfo: grantedInfo(true)});
    assert.deepEqual(await Promise.all([first, second]), [false, false]);
    await switchAccount;
    assert.equal(f.calls.filter(call => call.method === 'purchase').length, 1);
    assert.equal(f.repository.getState().adsRemoved, false);
    assert.equal(f.values.has(cacheKey('B')) && JSON.parse(f.values.get(cacheKey('B'))).adsRemoved, false);
    assert.equal(f.events.some(event => event.name === 'remove_ads_purchase_done'), false);
});

test('restore is coalesced, exposes progress, and ignores results for the previous account', async () => {
    let pending;
    const f = fixture({overrides: {info: () => pending ? pending.promise : grantedInfo()}});
    await f.repository.identify(null);
    pending = deferred();
    const first = f.repository.restore();
    const second = f.repository.restore();
    assert.equal(f.repository.getState().restoring, true);
    await tick();
    const change = f.repository.identify(account('B'));
    pending.resolve(grantedInfo(true));
    assert.deepEqual(await Promise.all([first, second]), [false, false]);
    await change;
    assert.equal(f.calls.filter(call => call.method === 'info').length, 2);
    assert.equal(f.repository.getState().restoring, false);
    assert.equal(f.repository.getState().adsRemoved, false);
    assert.equal(f.events.some(event => event.name === 'remove_ads_restore'), false);
});

test('foreground refresh is coalesced and updates subscription details without a restore event', async () => {
    let pending;
    const f = fixture({overrides: {info: () => pending ? pending.promise : grantedInfo()}});
    await f.repository.identify(null);
    pending = deferred();
    const first = f.repository.refresh();
    const second = f.repository.refresh();
    assert.equal(f.repository.getState().refreshing, true);
    pending.resolve(grantedInfo(true, {
        expirationDate: new Date('2030-01-01T00:00:00Z'), willRenew: true,
        billingIssueDetectedAt: new Date('2026-09-09T00:00:00Z'),
    }));
    await Promise.all([first, second]);
    assert.equal(f.calls.filter(call => call.method === 'info').length, 2);
    assert.equal(f.repository.getState().refreshing, false);
    assert.equal(f.repository.getState().expiresAt, '2030-01-01T00:00:00.000Z');
    assert.equal(f.repository.getState().willRenew, true);
    assert.equal(f.repository.getState().billingIssue, true);
    assert.equal(f.repository.getState().managementURL, 'https://billing.example.test/manage');
    assert.equal(f.events.some(event => event.name === 'remove_ads_restore'), false);
});

test('placement targeting exclusion remains empty and removes purchaseable offers from that placement', async () => {
    let excluded = false;
    const f = fixture({overrides: {offers: () => excluded ? null : offering()}});
    await f.repository.identify(null);
    const oldOffer = selectedOffer(f.repository);
    excluded = true;
    assert.deepEqual(await f.repository.getOffers('settings_supporter'), []);
    assert.deepEqual(f.repository.getState().offers, []);
    assert.equal(await f.repository.purchase(oldOffer), false);
    assert.equal(f.calls.some(call => call.method === 'purchase'), false);
});

test('a checkout queued behind placement exclusion cannot use the removed package', async () => {
    const pendingOffers = deferred();
    let refreshOffers = false;
    const f = fixture({overrides: {offers: () => refreshOffers ? pendingOffers.promise : offering()}});
    await f.repository.identify(null);
    const oldOffer = selectedOffer(f.repository);
    refreshOffers = true;
    const offers = f.repository.getOffers('settings_supporter');
    await tick();
    const purchase = f.repository.purchase(oldOffer);
    pendingOffers.resolve(null);
    assert.deepEqual(await offers, []);
    assert.equal(await purchase, false);
    assert.equal(f.repository.getState().purchasing, null);
    assert.equal(f.repository.getState().failure, 'offer_unavailable');
    assert.equal(f.calls.some(call => call.method === 'purchase'), false);
});

test('lapsed web subscription retains expiry and billing details without granting access', async () => {
    const f = fixture({overrides: {info: () => ({
        entitlements: {active: {}, all: {remove_ads: {
            expirationDate: new Date('2000-01-01T00:00:00Z'), willRenew: false,
            billingIssueDetectedAt: new Date('1999-12-30T00:00:00Z'),
        }}},
        managementURL: 'https://billing.example.test/manage',
    })}});
    await f.repository.identify(null);
    const state = f.repository.getState();
    assert.equal(state.adsRemoved, false);
    assert.equal(state.expiresAt, '2000-01-01T00:00:00.000Z');
    assert.equal(state.billingIssue, true);
    assert.equal(state.managementURL, 'https://billing.example.test/manage');
});

test('placement packages preserve price, period, offering and exact purchase/impression context', async () => {
    const monthly = pkg('$rc_monthly', 'Monthly supporter');
    monthly.webBillingProduct.productType = 'Subscription';
    monthly.webBillingProduct.normalPeriodDuration = 'P1M';
    const settings = offering('settings', [monthly]);
    const postAdPackage = pkg('$rc_monthly', 'Other placement product');
    const postAd = offering('post-ad', [postAdPackage]);
    const f = fixture({overrides: {offers: placement => placement === 'settings_supporter' ? settings : postAd}});
    await f.repository.identify(null);
    const settingsOffer = f.repository.getState().offers[0];
    const [other] = await f.repository.getOffers('post_ad_supporter');
    assert.notEqual(settingsOffer.id, other.id);
    assert.equal(settingsOffer.priceLabel, '$9.99');
    assert.equal(settingsOffer.billingPeriod, 'P1M');
    assert.equal(settingsOffer.recurring, true);
    assert.equal(settingsOffer.offeringId, 'settings');
    f.repository.trackPaywallImpression(other.id);
    assert.equal(f.calls.find(call => call.method === 'impression').params.offering, postAd);
    assert.equal(f.calls.find(call => call.method === 'impression').params.paywallId, 'post_ad_supporter');
    assert.equal(await f.repository.purchase(other.id), true);
    assert.equal(f.calls.find(call => call.method === 'purchase').params.rcPackage, postAdPackage);
});

test('delayed offerings from the previous account cannot repopulate its paywall or be purchased', async () => {
    let pending;
    const f = fixture({overrides: {offers: () => pending ? pending.promise : offering()}});
    await f.repository.identify(account('A'));
    const old = selectedOffer(f.repository);
    pending = deferred();
    const loading = f.repository.getOffers('post_ad_supporter');
    await tick();
    const next = f.repository.identify(account('B'));
    const response = pending;
    pending = undefined;
    response.resolve(offering('stale'));
    assert.deepEqual(await loading, []);
    await next;
    f.repository.trackPaywallImpression(old);
    assert.equal(f.calls.some(call => call.method === 'impression'), false);
    assert.equal(f.repository.getState().offers.some(item => item.offeringId === 'stale'), false);
});

test('checkout failure reasons retain cancellation, pending and already-purchased behavior', async () => {
    for (const [code, reason] of [[1, 'cancelled'], [6, 'already_purchased'], [20, 'pending'], [0, 'unknown']]) {
        let f;
        f = fixture({overrides: {purchase: () => { throw new f.PurchasesError(code); }}});
        await f.repository.identify(null);
        assert.equal(await f.repository.purchase(selectedOffer(f.repository)), false);
        assert.equal(f.repository.getState().purchasing, null);
        assert.equal(f.repository.getState().failure, reason);
        assert.equal(f.events.at(-1).params.reason, reason);
    }
});

test('restore failure clears progress and can recover without reconfiguration', async () => {
    let fail = false;
    const f = fixture({overrides: {info: () => { if (fail) throw Error('offline'); return grantedInfo(true); }}});
    await f.repository.identify(null);
    fail = true;
    assert.equal(await f.repository.restore(), false);
    assert.equal(f.repository.getState().failure, 'restore_failed');
    assert.equal(f.repository.getState().restoring, false);
    assert.equal(f.repository.getState().adsRemoved, true);
    fail = false;
    assert.equal(await f.repository.restore(), true);
    assert.equal(f.repository.getState().failure, null);
    assert.equal(f.calls.filter(call => call.method === 'configure').length, 1);
});

test('missing web key and server rendering perform no SDK work', async () => {
    const f = fixture({apiKey: null});
    await f.repository.identify(null);
    await f.repository.refresh();
    assert.equal(await f.repository.restore(), false);
    assert.deepEqual(await f.repository.getOffers('settings_supporter'), []);
    assert.deepEqual(f.calls, []);
    const server = fixture();
    delete global.window;
    await server.repository.identify(null);
    await server.repository.init();
    assert.deepEqual(server.calls, []);
});

test('returning to the visible page refreshes customer details once and hidden pages do no work', async () => {
    const listeners = new Map();
    global.window.addEventListener = (type, handler) => listeners.set(type, handler);
    global.document = {visibilityState: 'visible', addEventListener: (type, handler) => listeners.set(type, handler)};
    const f = fixture();
    await f.repository.identify(null);
    await f.repository.init();
    assert.equal(listeners.size, 2);
    listeners.get('focus')();
    listeners.get('visibilitychange')();
    await tick();
    assert.equal(f.calls.filter(call => call.method === 'info').length, 2);
    global.document.visibilityState = 'hidden';
    listeners.get('focus')();
    listeners.get('visibilitychange')();
    await tick();
    assert.equal(f.calls.filter(call => call.method === 'info').length, 2);
});
