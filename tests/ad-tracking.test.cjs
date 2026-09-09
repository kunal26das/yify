const assert = require('node:assert/strict');
const {test} = require('node:test');
const {loadTypeScript} = require('./helpers/load-typescript.cjs');

const eventTypes = Object.fromEntries(
    ['LOADED', 'OPENED', 'CLICKED', 'PAID', 'CLOSED', 'ERROR'].map((name) => [name, name.toLowerCase()])
);
const productionUnit = 'ca-app-pub-2292299294214510/8726265265';
const paid = (value = 0.004567, precision = 3, currency = 'USD') => ({value, precision, currency});

function fixture(t, {dev = false, show, entitlement = () => ({ready: true, adsRemoved: false})} = {}) {
    t.mock.timers.enable({apis: ['setTimeout']});
    const originalDev = global.__DEV__;
    global.__DEV__ = dev;
    t.after(() => {
        if (originalDev === undefined) delete global.__DEV__;
        else global.__DEV__ = originalDev;
    });
    const ads = [];
    const tracked = [];
    const analytics = [];
    const {AdMobAdGateway} = loadTypeScript('data/services/AdMobAdGateway.ts', {
        'react-native': {Platform: {OS: 'android'}},
        'react-native-google-mobile-ads': {
            __esModule: true,
            default: () => ({setRequestConfiguration: async () => {}, initialize: async () => {}}),
            AdsConsent: {gatherConsent: async () => ({canRequestAds: true})},
            AdsConsentPrivacyOptionsRequirementStatus: {REQUIRED: 'REQUIRED'},
            MaxAdContentRating: {T: 'T'},
            RevenuePrecisions: {UNKNOWN: 0, ESTIMATED: 1, PUBLISHER_PROVIDED: 2, PRECISE: 3},
            AdEventType: eventTypes,
            TestIds: {INTERSTITIAL: 'test-interstitial'},
            InterstitialAd: {
                createForAdRequest: (adUnitId) => {
                    const listeners = new Map();
                    const ad = {
                        adUnitId,
                        show: show ?? (async () => {}),
                        load: () => {},
                        addAdEventListener: (event, listener) => {
                            const set = listeners.get(event) ?? new Set();
                            listeners.set(event, set);
                            set.add(listener);
                            return () => set.delete(listener);
                        },
                        emit: (event, payload) => {
                            for (const listener of [...(listeners.get(event) ?? [])]) listener(payload);
                        },
                        count: (event) => event
                            ? (listeners.get(event)?.size ?? 0)
                            : [...listeners.values()].reduce((sum, set) => sum + set.size, 0),
                    };
                    ads.push(ad);
                    return ad;
                },
            },
        },
        '../datasources/platform/ForegroundWatcher': {isForeground: () => true, watchForeground: () => () => {}},
    });
    const methods = ['trackLoaded', 'trackDisplayed', 'trackOpened', 'trackFailedToLoad', 'trackImpression'];
    const gateway = new AdMobAdGateway({
        analytics: {trackEvent: (name, data) => analytics.push({name, data})},
        adRevenue: Object.fromEntries(methods.map((method) => [method, (data) => tracked.push({method, data})])),
        entitlement,
    });
    return {gateway, ads, tracked, analytics};
}

test('preload tracking does not wait for identity, while showing waits for known entitlement', async (t) => {
    let state = {ready: false, adsRemoved: false};
    let showCount = 0;
    const {gateway, ads, tracked} = fixture(t, {
        entitlement: () => state,
        show: async () => { showCount++; },
    });
    await gateway.init();
    const ad = ads[0];
    ad.emit('loaded');
    assert.deepEqual(tracked.map(({method}) => method), ['trackLoaded']);
    assert.equal(gateway.show('movie_open'), null);
    assert.equal(showCount, 0);

    state = {ready: true, adsRemoved: true};
    assert.equal(gateway.show('movie_open'), null);
    assert.equal(showCount, 0);

    state = {ready: true, adsRemoved: false};
    const completion = gateway.show('movie_open');
    assert.equal(showCount, 1);
    ad.emit('opened');
    ad.emit('paid', paid());
    ad.emit('closed');
    assert.equal(await completion, true);
    assert.deepEqual(tracked.map(({method}) => method), ['trackLoaded', 'trackDisplayed', 'trackImpression']);
});

test('load failures are tracked while identity and entitlement are still unresolved', async (t) => {
    const {gateway, ads, tracked} = fixture(t, {
        entitlement: () => ({ready: false, adsRemoved: false}),
    });
    await gateway.init();
    ads[0].emit('error', {code: 'googleMobileAds/no-fill'});
    assert.deepEqual(tracked, [{method: 'trackFailedToLoad', data: {
        adUnitId: productionUnit, placement: 'movie_open',
    }}]);
    assert.equal(gateway.show('movie_open'), null);
});

test('load, display, click, and revenue share one impression and movie placement', async (t) => {
    const {gateway, ads, tracked} = fixture(t);
    await gateway.init();
    const ad = ads[0];
    ad.emit('loaded');
    ad.emit('loaded');
    const completion = gateway.show('movie_open');
    ad.emit('opened');
    ad.emit('opened');
    assert.deepEqual(tracked.map(({method}) => method), ['trackLoaded', 'trackDisplayed']);
    ad.emit('clicked');
    ad.emit('clicked');
    ad.emit('paid', paid());
    ad.emit('paid', paid());
    ad.emit('closed');
    assert.equal(await completion, true);
    assert.deepEqual(tracked.map(({method}) => method), [
        'trackLoaded', 'trackDisplayed', 'trackOpened', 'trackImpression',
    ]);
    const context = tracked[0].data;
    assert.equal(context.adUnitId, productionUnit);
    assert.equal(context.placement, 'movie_open');
    assert.equal('networkName' in context, false);
    assert.deepEqual(tracked.slice(0, 3).map(({data}) => data), [context, context, context]);
    assert.deepEqual(tracked[3].data, {...context, value: 0.004567, currency: 'USD', precision: 'exact'});
    assert.equal(ad.count(), 0);
    ads[1].emit('loaded');
    assert.notEqual(tracked.at(-1).data.impressionId, context.impressionId);
});

test('load failure is reported once and never invents a numeric mediator code', async (t) => {
    const {gateway, ads, tracked} = fixture(t);
    await gateway.init();
    const ad = ads[0];
    ad.emit('error', {code: 'googleMobileAds/no-fill'});
    ad.emit('error', {code: 'googleMobileAds/no-fill'});
    ad.emit('paid', paid());
    assert.deepEqual(tracked, [{method: 'trackFailedToLoad', data: {
        adUnitId: productionUnit, placement: 'movie_open',
    }}]);
    assert.equal(ad.count('paid'), 0);
    t.mock.timers.tick(30000);
    assert.equal(ads.length, 2);
    assert.equal(ad.count(), 0);
});

test('invalid paid payloads are ignored without blocking a later valid zero revenue callback', async (t) => {
    const {gateway, ads, tracked, analytics} = fixture(t);
    await gateway.init();
    const ad = ads[0];
    for (const payload of [
        undefined, {}, paid(-1), paid(NaN), paid(Infinity), paid('1'),
        paid(Number.MAX_SAFE_INTEGER), paid(1, 3, ''), {value: 1, precision: 3}, paid(1, 3, 'US'),
    ]) {
        ad.emit('paid', payload);
    }
    assert.equal(tracked.length, 0);
    assert.equal(analytics.filter(({name}) => name === 'ad_impression').length, 0);
    assert.equal(ad.count('paid'), 1);
    ad.emit('paid', paid(0, 2, 'usd'));
    ad.emit('paid', paid(10));
    assert.equal(tracked.length, 1);
    assert.equal(tracked[0].data.value, 0);
    assert.equal(tracked[0].data.currency, 'USD');
    assert.equal(tracked[0].data.precision, 'publisher_defined');
    assert.equal(analytics.filter(({name}) => name === 'ad_impression').length, 1);
});

test('all AdMob revenue precision values retain their meaning', async (t) => {
    const {gateway, ads, tracked} = fixture(t);
    await gateway.init();
    for (const precision of [0, 1, 2, 3, 99]) {
        const ad = ads.at(-1);
        ad.emit('loaded');
        const completion = gateway.show('movie_open');
        ad.emit('paid', paid(0.000001, precision));
        ad.emit('closed');
        await completion;
    }
    assert.deepEqual(tracked.filter(({method}) => method === 'trackImpression').map(({data}) => data.precision),
        ['unknown', 'estimated', 'publisher_defined', 'exact', 'unknown']);
});

test('revenue arriving after close keeps the completed impression context and is deduplicated', async (t) => {
    const {gateway, ads, tracked} = fixture(t);
    await gateway.init();
    const ad = ads[0];
    ad.emit('loaded');
    const completion = gateway.show('movie_open');
    ad.emit('opened');
    ad.emit('closed');
    await completion;
    const firstContext = tracked[0].data;
    ads[1].emit('loaded');
    t.mock.timers.tick(30000);
    ad.emit('paid', paid());
    ad.emit('paid', paid());
    const revenue = tracked.filter(({method}) => method === 'trackImpression');
    assert.equal(revenue.length, 1);
    assert.equal(revenue[0].data.impressionId, firstContext.impressionId);
    assert.equal(ad.count(), 0);
});

test('missing paid callbacks release listeners after the post-close grace period', async (t) => {
    const {gateway, ads} = fixture(t);
    await gateway.init();
    const ad = ads[0];
    ad.emit('loaded');
    const completion = gateway.show('movie_open');
    ad.emit('closed');
    await completion;
    assert.equal(ad.count('paid'), 1);
    t.mock.timers.tick(60000);
    assert.equal(ad.count(), 0);
});

test('navigation timeout does not lose later clicks or revenue while the ad remains visible', async (t) => {
    const {gateway, ads, tracked} = fixture(t);
    await gateway.init();
    const ad = ads[0];
    ad.emit('loaded');
    const completion = gateway.show('movie_open');
    ad.emit('opened');
    t.mock.timers.tick(8000);
    assert.equal(await completion, true);
    ad.emit('clicked');
    ad.emit('paid', paid());
    ad.emit('closed');
    assert.deepEqual(tracked.map(({method}) => method), [
        'trackLoaded', 'trackDisplayed', 'trackOpened', 'trackImpression',
    ]);
    assert.equal(ad.count(), 0);
});

test('missing terminal callbacks cannot retain tracking listeners indefinitely', async (t) => {
    const {gateway, ads} = fixture(t);
    await gateway.init();
    const ad = ads[0];
    ad.emit('loaded');
    const completion = gateway.show('movie_open');
    ad.emit('opened');
    t.mock.timers.tick(30 * 60 * 1000);
    await completion;
    assert.equal(ad.count(), 0);
});

test('show rejection is not mislabeled as a load failure and releases tracking after grace', async (t) => {
    const {gateway, ads, tracked} = fixture(t, {show: async () => { throw new Error('show failed'); }});
    await gateway.init();
    const ad = ads[0];
    ad.emit('loaded');
    assert.equal(await gateway.show('movie_open'), false);
    assert.deepEqual(tracked.map(({method}) => method), ['trackLoaded']);
    t.mock.timers.tick(60000);
    assert.equal(ad.count(), 0);
});

test('development test ads remain available to RevenueCat native sandbox reporting', async (t) => {
    const {gateway, ads, tracked} = fixture(t, {dev: true});
    await gateway.init();
    const ad = ads[0];
    ad.emit('loaded');
    ad.emit('paid', paid());
    assert.equal(ad.adUnitId, 'test-interstitial');
    assert.deepEqual(tracked.map(({method}) => method), ['trackLoaded', 'trackImpression']);
});
