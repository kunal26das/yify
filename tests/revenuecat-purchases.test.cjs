const assert = require('node:assert/strict');
const {test} = require('node:test');
const {loadTypeScript} = require('./helpers/load-typescript.cjs');

function deferred() {
    let resolve;
    let reject;
    const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
    return {promise, resolve, reject};
}
const flush = () => new Promise((resolve) => setImmediate(resolve));
const account = (uid) => ({uid, name: uid, email: null, photoUrl: null});
const customer = (removed = false, extra = {}) => ({
    entitlements: {active: removed ? {remove_ads: {
        expirationDate: '2027-01-01T00:00:00Z', willRenew: true, billingIssueDetectedAt: null,
    }} : {}},
    managementURL: null,
    ...extra,
});
const offering = (identifier = 'default', packageId = '$rc_monthly') => ({
    identifier,
    availablePackages: [{
        identifier: packageId,
        product: {
            title: 'Supporter', priceString: '$2.99', productCategory: 'SUBSCRIPTION', subscriptionPeriod: 'P1M',
        },
        presentedOfferingContext: {offeringIdentifier: identifier, placementIdentifier: 'settings_supporter'},
    }],
});

function fixture(t, options = {}) {
    t.mock.timers.enable({apis: ['setTimeout']});
    const previousKey = process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_KEY;
    process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_KEY = 'test-configured-key';
    t.after(() => {
        if (previousKey === undefined) delete process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_KEY;
        else process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_KEY = previousKey;
    });
    let sdkUid = options.uid ?? '$RCAnonymousID:initial';
    let anonymousSequence = 0;
    const infos = new Map(options.infos ?? []);
    const calls = [];
    const listeners = [];
    const foreground = [];
    const cache = new Map(options.cache ?? []);
    const currentInfo = () => infos.get(sdkUid) ?? customer(false);
    const defaultOffering = offering();
    const sdk = {
        setLogLevel: () => {},
        configure: async () => { calls.push(['configure']); await options.configure?.(); },
        getAppUserID: async () => sdkUid,
        isAnonymous: async () => sdkUid.startsWith('$RCAnonymousID:'),
        addCustomerInfoUpdateListener: (listener) => { listeners.push(listener); },
        logIn: async (uid) => {
            calls.push(['login', uid]);
            const result = await options.login?.(uid);
            sdkUid = uid;
            return {customerInfo: result ?? currentInfo()};
        },
        logOut: async () => {
            calls.push(['logout', sdkUid]);
            sdkUid = `$RCAnonymousID:logout-${++anonymousSequence}`;
            return currentInfo();
        },
        getCustomerInfo: async () => {
            calls.push(['customer', sdkUid]);
            return options.getCustomerInfo ? options.getCustomerInfo(sdkUid) : currentInfo();
        },
        invalidateCustomerInfoCache: async () => { calls.push(['invalidate']); },
        getCurrentOfferingForPlacement: async (placement) => {
            calls.push(['offers', sdkUid, placement]);
            return options.offerings ? options.offerings(placement, sdkUid) : defaultOffering;
        },
        trackCustomPaywallImpression: async (data) => { calls.push(['impression', sdkUid, data]); },
        purchasePackage: async (pkg) => {
            calls.push(['purchase', sdkUid, pkg]);
            return options.purchase ? options.purchase(pkg, sdkUid) : {customerInfo: customer(true)};
        },
        restorePurchases: async () => {
            calls.push(['restore', sdkUid]);
            return options.restore ? options.restore(sdkUid) : customer(true);
        },
        setFirebaseAppInstanceID: async () => {
            calls.push(['analytics-id', sdkUid]);
            await options.linkAnalytics?.();
        },
        PURCHASES_ERROR_CODE: {
            PURCHASE_CANCELLED_ERROR: 'cancelled', PRODUCT_ALREADY_PURCHASED_ERROR: 'already', PAYMENT_PENDING_ERROR: 'pending',
        },
    };
    const {RevenueCatPurchaseRepositoryImpl} = loadTypeScript('data/repositories/RevenueCatPurchaseRepositoryImpl.ts', {
        'react-native': {Platform: {OS: 'android'}},
        'react-native-purchases': {
            __esModule: true, default: sdk, LOG_LEVEL: {WARN: 'WARN'}, PRODUCT_CATEGORY: {SUBSCRIPTION: 'SUBSCRIPTION'},
        },
        '../datasources/platform/ForegroundWatcher': {watchForeground: (listener) => { foreground.push(listener); }},
        '../datasources/analytics/FirebaseAnalyticsSink': {
            getAnalyticsInstanceId: async () => options.analyticsInstanceId ? options.analyticsInstanceId() : 'analytics-id',
        },
    });
    const repository = new RevenueCatPurchaseRepositoryImpl({
        trackEvent: (...args) => { calls.push(['analytics', ...args]); },
        setUserProperty: (...args) => { calls.push(['property', ...args]); },
    }, {
        getString: (key) => cache.get(key), set: (key, value) => cache.set(key, value), delete: (key) => cache.delete(key),
    });
    return {repository, calls, listeners, foreground, infos, cache, defaultOffering,
        uid: () => sdkUid,
        ready: async (uid = null) => {
            await Promise.all([repository.init(), repository.identify(uid == null ? null : account(uid))]);
        },
    };
}

test('configuration is shared and entitlement readiness waits for the initial auth identity', async (t) => {
    const {repository, calls, listeners, foreground} = fixture(t, {cache: [['ads_removed', 'true']]});
    const first = repository.init();
    assert.equal(repository.init(), first);
    await first;
    assert.equal(repository.getState().ready, false);
    assert.equal(repository.getState().adsRemoved, false);
    await repository.identify(null);
    assert.equal(repository.getState().ready, true);
    assert.equal(calls.filter(([name]) => name === 'configure').length, 1);
    assert.equal(calls.filter(([name]) => name === 'logout').length, 0);
    assert.equal(listeners.length, 1);
    assert.equal(foreground.length, 1);
});

test('customer-fetch retries do not reconfigure or register duplicate listeners', async (t) => {
    let attempts = 0;
    const f = fixture(t, {getCustomerInfo: async () => {
        if (++attempts === 1) throw new Error('offline');
        return customer(true);
    }});
    await f.ready();
    assert.equal(f.repository.getState().ready, false);
    t.mock.timers.tick(5000);
    await flush();
    assert.equal(f.repository.getState().ready, true);
    assert.equal(f.repository.getState().adsRemoved, true);
    assert.equal(f.calls.filter(([name]) => name === 'configure').length, 1);
    assert.equal(f.listeners.length, 1);
    assert.equal(f.foreground.length, 1);
    t.mock.timers.tick(300000);
    await flush();
    assert.equal(attempts, 2);
});

test('missing or rejected Firebase analytics IDs retry on later refresh without hiding entitlements', async (t) => {
    let instanceId = null;
    let linkAttempts = 0;
    const f = fixture(t, {
        analyticsInstanceId: () => instanceId,
        linkAnalytics: async () => { if (++linkAttempts === 1) throw new Error('temporarily unavailable'); },
    });
    await f.ready();
    assert.equal(f.repository.getState().ready, true);
    assert.equal(linkAttempts, 0);
    instanceId = 'analytics-id';
    f.foreground[0]();
    await flush();
    assert.equal(f.repository.getState().ready, true);
    assert.equal(linkAttempts, 1);
    f.foreground[0]();
    await flush();
    assert.equal(linkAttempts, 2);
    f.foreground[0]();
    await flush();
    assert.equal(linkAttempts, 2);
});

test('failed account identification retries without another AccountLink identity event or automatic restore', async (t) => {
    let attempts = 0;
    const f = fixture(t, {login: async () => {
        if (++attempts === 1) throw new Error('offline');
        return customer(false);
    }});
    await f.ready('account-a');
    assert.equal(f.repository.getState().ready, false);
    t.mock.timers.tick(5000);
    await flush();
    assert.equal(f.repository.getState().ready, true);
    assert.equal(f.uid(), 'account-a');
    assert.equal(attempts, 2);
    assert.equal(f.calls.filter(([name]) => name === 'restore').length, 0);
    await f.repository.identify(account('account-a'));
    assert.equal(attempts, 2);
});

test('latest account wins an in-flight login without exposing an intermediate entitlement', async (t) => {
    const loginA = deferred();
    const f = fixture(t, {login: (uid) => uid === 'account-a' ? loginA.promise : customer(false)});
    await f.ready();
    const seen = [];
    f.repository.subscribe(() => seen.push({...f.repository.getState()}));
    const first = f.repository.identify(account('account-a'));
    await flush();
    const second = f.repository.identify(account('account-b'));
    assert.equal(f.repository.getState().ready, false);
    loginA.resolve(customer(true));
    await Promise.all([first, second]);
    assert.equal(f.uid(), 'account-b');
    assert.equal(f.repository.getState().ready, true);
    assert.equal(f.repository.getState().adsRemoved, false);
    assert.equal(seen.some((state) => state.ready && state.adsRemoved), false);
    assert.equal(f.cache.get('ads_removed:v2:account-a'), undefined);
});

test('signed-out customers receive a fresh anonymous identity and never another account cache', async (t) => {
    const f = fixture(t, {uid: 'account-a', infos: [['account-a', customer(true)]], cache: [
        ['ads_removed', 'true'], ['ads_removed:v2:account-a', 'true'],
    ]});
    await f.ready('account-a');
    assert.equal(f.repository.getState().adsRemoved, true);
    const signingOut = f.repository.identify(null);
    assert.equal(f.repository.getState().ready, false);
    assert.equal(f.repository.getState().adsRemoved, false);
    await signingOut;
    assert.match(f.uid(), /^\$RCAnonymousID:logout-/);
    assert.equal(f.repository.getState().adsRemoved, false);
    assert.equal(JSON.parse(f.cache.get('ads_removed:v2:account-a')).adsRemoved, true);
    assert.deepEqual(JSON.parse(f.cache.get(`ads_removed:v2:${encodeURIComponent(f.uid())}`)), {
        adsRemoved: false, expiresAt: null,
    });
    await f.repository.identify(null);
    assert.equal(f.calls.filter(([name]) => name === 'logout').length, 1);
});

test('concurrent purchase taps share one native purchase and block a conflicting restore', async (t) => {
    const pendingPurchase = deferred();
    const f = fixture(t, {purchase: () => pendingPurchase.promise});
    await f.ready();
    const offer = f.repository.getState().offers[0];
    const first = f.repository.purchase(offer.id);
    assert.equal(f.repository.purchase(offer.id), first);
    assert.equal(await f.repository.restore(), false);
    await flush();
    assert.equal(f.calls.filter(([name]) => name === 'purchase').length, 1);
    assert.equal(f.repository.getState().purchasing, offer.id);
    pendingPurchase.resolve({customerInfo: customer(true)});
    assert.equal(await first, true);
    assert.equal(f.repository.getState().purchasing, null);
    assert.equal(f.repository.getState().adsRemoved, true);
});

test('identity changes wait for a native purchase and cannot receive its entitlement', async (t) => {
    const pendingPurchase = deferred();
    const f = fixture(t, {purchase: () => pendingPurchase.promise});
    await f.ready('account-a');
    const purchase = f.repository.purchase(f.repository.getState().offers[0].id);
    await flush();
    const change = f.repository.identify(account('account-b'));
    await flush();
    assert.equal(f.uid(), 'account-a');
    assert.equal(f.repository.getState().ready, false);
    pendingPurchase.resolve({customerInfo: customer(true)});
    assert.equal(await purchase, false);
    await change;
    assert.equal(f.uid(), 'account-b');
    assert.equal(f.repository.getState().adsRemoved, false);
    assert.deepEqual(f.calls.filter(([name]) => ['purchase', 'login'].includes(name)).map((c) => c.slice(0, 2)), [
        ['login', 'account-a'], ['purchase', 'account-a'], ['login', 'account-b'],
    ]);
});

test('explicit restores are single-flight and report progress without automatic login restores', async (t) => {
    const pendingRestore = deferred();
    const f = fixture(t, {restore: () => pendingRestore.promise});
    await f.ready('account-a');
    assert.equal(f.calls.some(([name]) => name === 'restore'), false);
    const first = f.repository.restore();
    assert.equal(f.repository.restore(), first);
    assert.equal(f.repository.getState().restoring, true);
    assert.equal(await f.repository.purchase(f.repository.getState().offers[0].id), false);
    pendingRestore.resolve(customer(true));
    assert.equal(await first, true);
    assert.equal(f.repository.getState().restoring, false);
    assert.equal(f.calls.filter(([name]) => name === 'restore').length, 1);
});

test('purchase cancellation and pending payment retain their actionable failure reason', async (t) => {
    let error = {code: 'pending'};
    const f = fixture(t, {purchase: async () => { throw error; }});
    await f.ready();
    const offerId = f.repository.getState().offers[0].id;
    assert.equal(await f.repository.purchase(offerId), false);
    assert.equal(f.repository.getState().failure, 'pending');
    error = {userCancelled: true};
    assert.equal(await f.repository.purchase(offerId), false);
    assert.equal(f.repository.getState().failure, 'cancelled');
    assert.equal(f.repository.getState().purchasing, null);
});

test('unsolicited listener data cannot overwrite the current customer and foreground refreshes entitlement', async (t) => {
    const f = fixture(t, {uid: 'account-b'});
    await f.ready('account-b');
    f.listeners[0](customer(true));
    await flush();
    assert.equal(f.repository.getState().adsRemoved, false);
    f.infos.set('account-b', customer(true));
    f.foreground[0]();
    await flush();
    assert.equal(f.repository.getState().adsRemoved, true);
    assert.equal(f.calls.filter(([name]) => name === 'restore').length, 0);
});

test('explicit refresh invalidates the SDK cache once and preserves verified access if refresh fails', async (t) => {
    let fail = false;
    const f = fixture(t, {getCustomerInfo: async () => {
        if (fail) throw new Error('offline');
        return customer(true);
    }});
    await f.ready();
    fail = true;
    const first = f.repository.refresh();
    assert.equal(f.repository.refresh(), first);
    assert.equal(f.repository.getState().refreshing, true);
    await first;
    assert.equal(f.repository.getState().refreshing, false);
    assert.equal(f.repository.getState().ready, true);
    assert.equal(f.repository.getState().adsRemoved, true);
    assert.equal(f.calls.filter(([name]) => name === 'invalidate').length, 1);
});

test('customer changes arriving after the snapshot during offerings loading are refreshed before completion', async (t) => {
    const pendingOffers = deferred();
    let holdOffers = false;
    const f = fixture(t, {offerings: () => holdOffers ? pendingOffers.promise : offering()});
    await f.ready();
    holdOffers = true;
    const refresh = f.repository.refresh();
    await flush();
    f.infos.set(f.uid(), customer(true));
    f.listeners[0](customer(true));
    holdOffers = false;
    pendingOffers.resolve(offering());
    await refresh;
    assert.equal(f.repository.getState().adsRemoved, true);
    const reads = f.calls.filter(([name]) => name === 'customer').length;
    f.listeners[0](customer(true));
    await flush();
    assert.equal(f.calls.filter(([name]) => name === 'customer').length, reads);
});

test('subscription management, expiry, renewal, and billing issue follow current customer info', async (t) => {
    const f = fixture(t, {infos: [['account-a', customer(true, {
        managementURL: 'https://play.google.com/store/account/subscriptions',
        entitlements: {active: {remove_ads: {
            expirationDate: '2027-02-01T00:00:00Z', willRenew: false, billingIssueDetectedAt: '2027-01-01T00:00:00Z',
        }}},
    })]]});
    await f.ready('account-a');
    const state = f.repository.getState();
    assert.equal(state.managementURL, 'https://play.google.com/store/account/subscriptions');
    assert.equal(state.expiresAt, '2027-02-01T00:00:00Z');
    assert.equal(state.willRenew, false);
    assert.equal(state.billingIssue, true);
    const change = f.repository.identify(account('account-b'));
    assert.equal(f.repository.getState().managementURL, null);
    assert.equal(f.repository.getState().expiresAt, null);
    assert.equal(f.repository.getState().billingIssue, false);
    await change;
});

test('lapsed subscription metadata is preserved without granting access', async (t) => {
    const f = fixture(t, {getCustomerInfo: async () => customer(false, {
        entitlements: {active: {}, all: {remove_ads: {
            expirationDate: '2000-01-01T00:00:00Z', willRenew: false, billingIssueDetectedAt: '1999-12-30T00:00:00Z',
        }}},
    })});
    await f.ready();
    assert.equal(f.repository.getState().adsRemoved, false);
    assert.equal(f.repository.getState().expiresAt, '2000-01-01T00:00:00Z');
    assert.equal(f.repository.getState().billingIssue, true);
});

test('offline caches are scoped, expiry aware, and do not trust old booleans', async (t) => {
    const pending = deferred();
    const f = fixture(t, {getCustomerInfo: () => pending.promise, cache: [
        ['ads_removed', 'true'],
        ['ads_removed:v2:expired', JSON.stringify({adsRemoved: true, expiresAt: '2000-01-01T00:00:00Z'})],
        ['ads_removed:v2:valid', JSON.stringify({adsRemoved: true, expiresAt: '2999-01-01T00:00:00Z'})],
        ['ads_removed:v2:lifetime', JSON.stringify({adsRemoved: true, expiresAt: null})],
        ['ads_removed:v2:legacy', 'true'],
    ]});
    const expired = f.repository.identify(account('expired'));
    assert.equal(f.repository.getState().adsRemoved, false);
    const valid = f.repository.identify(account('valid'));
    assert.equal(f.repository.getState().adsRemoved, true);
    const lifetime = f.repository.identify(account('lifetime'));
    assert.equal(f.repository.getState().adsRemoved, true);
    const legacy = f.repository.identify(account('legacy'));
    assert.equal(f.repository.getState().adsRemoved, false);
    assert.equal(f.repository.getState().ready, false);
    pending.resolve(customer(false));
    await Promise.all([expired, valid, lifetime, legacy]);
});

test('targeted offerings preserve period, package, placement, and actual impression context', async (t) => {
    const settings = offering('settings-offering');
    const afterAd = offering('after-ad-offering');
    const f = fixture(t, {offerings: (placement) => placement === 'settings_supporter' ? settings : afterAd});
    await f.ready();
    const settingsOffer = f.repository.getState().offers[0];
    const [adOffer] = await f.repository.getOffers('post_ad_supporter');
    assert.notEqual(settingsOffer.id, adOffer.id);
    assert.equal(adOffer.offeringId, 'after-ad-offering');
    assert.equal(adOffer.placement, 'post_ad_supporter');
    assert.equal(adOffer.billingPeriod, 'P1M');
    assert.equal(adOffer.priceLabel, '$2.99');
    f.repository.trackPaywallImpression(adOffer.id);
    await flush();
    assert.equal(f.calls.find(([name]) => name === 'impression')[2].offering, afterAd);
    assert.equal(f.calls.find(([name]) => name === 'impression')[2].paywallId, 'post_ad_supporter');
    await f.repository.purchase(adOffer.id);
    assert.equal(f.calls.find(([name]) => name === 'purchase')[2], afterAd.availablePackages[0]);
});

test('explicit targeting exclusion removes old packages and never falls back to the default offering', async (t) => {
    let excluded = false;
    const f = fixture(t, {offerings: () => excluded ? null : offering()});
    await f.ready();
    const staleOffer = f.repository.getState().offers[0];
    excluded = true;
    assert.deepEqual(await f.repository.getOffers('settings_supporter'), []);
    assert.deepEqual(f.repository.getState().offers, []);
    assert.equal(await f.repository.purchase(staleOffer.id), false);
    f.repository.trackPaywallImpression(staleOffer.id);
    await flush();
    assert.equal(f.calls.some(([name]) => name === 'impression'), false);
});

test('an old account dialog cannot buy or record an impression for identical new-account package names', async (t) => {
    const f = fixture(t);
    await f.ready('account-a');
    const oldOffer = f.repository.getState().offers[0];
    await f.repository.identify(account('account-b'));
    const currentOffer = f.repository.getState().offers[0];
    assert.notEqual(oldOffer.id, currentOffer.id);
    assert.equal(await f.repository.purchase(oldOffer.id), false);
    f.repository.trackPaywallImpression(oldOffer.id);
    await flush();
    assert.equal(f.calls.some(([name]) => name === 'purchase' || name === 'impression'), false);
});

test('a purchase queued behind targeting exclusion cannot use the removed package', async (t) => {
    const pendingOffers = deferred();
    let refreshOffers = false;
    const f = fixture(t, {offerings: () => refreshOffers ? pendingOffers.promise : offering()});
    await f.ready();
    const oldOffer = f.repository.getState().offers[0];
    refreshOffers = true;
    const offers = f.repository.getOffers('settings_supporter');
    await flush();
    const purchase = f.repository.purchase(oldOffer.id);
    pendingOffers.resolve(null);
    assert.deepEqual(await offers, []);
    assert.equal(await purchase, false);
    assert.equal(f.repository.getState().purchasing, null);
    assert.equal(f.repository.getState().failure, 'offer_unavailable');
    assert.equal(f.calls.some(([name]) => name === 'purchase'), false);
});

test('Android prices describe the regular default option period and prepaid renewal accurately', async (t) => {
    const prepaid = offering('prepaid');
    Object.assign(prepaid.availablePackages[0].product, {
        priceString: '$0.00', subscriptionPeriod: 'P1W',
        defaultOption: {
            isPrepaid: true,
            fullPricePhase: {price: {formatted: '$12.99'}, billingPeriod: {iso8601: 'P3M'}},
        },
    });
    const f = fixture(t, {offerings: () => prepaid});
    await f.ready();
    const offer = f.repository.getState().offers[0];
    assert.equal(offer.priceLabel, '$12.99');
    assert.equal(offer.billingPeriod, 'P3M');
    assert.equal(offer.recurring, true);
    assert.equal(offer.autoRenewing, false);
});

test('late targeted offers from an old account cannot replace new account packages', async (t) => {
    const pendingOffers = deferred();
    const f = fixture(t, {offerings: (placement, uid) =>
        placement === 'post_ad_supporter' && uid === 'account-a' ? pendingOffers.promise : offering(uid)});
    await f.ready('account-a');
    const first = f.repository.getOffers('post_ad_supporter');
    assert.equal(f.repository.getOffers('post_ad_supporter'), first);
    await flush();
    const change = f.repository.identify(account('account-b'));
    pendingOffers.resolve(offering('stale-a'));
    assert.deepEqual(await first, []);
    await change;
    const [fresh] = await f.repository.getOffers('post_ad_supporter');
    assert.equal(fresh.offeringId, 'account-b');
});

test('offerings failures use increasing retry delays without repeatedly configuring the SDK', async (t) => {
    let attempts = 0;
    const f = fixture(t, {offerings: async () => {
        attempts += 1;
        throw new Error('offerings offline');
    }});
    await f.ready();
    assert.equal(attempts, 1);
    t.mock.timers.tick(5000);
    await flush();
    assert.equal(attempts, 2);
    t.mock.timers.tick(5000);
    await flush();
    assert.equal(attempts, 2);
    t.mock.timers.tick(10000);
    await flush();
    assert.equal(attempts, 3);
    assert.equal(f.calls.filter(([name]) => name === 'configure').length, 1);
});
