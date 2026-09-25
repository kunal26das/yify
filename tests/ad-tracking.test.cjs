const assert = require('node:assert/strict');
const {test} = require('node:test');
const {loadTypeScript} = require('./helpers/load-typescript.cjs');

const eventTypes = Object.fromEntries(
    ['LOADED', 'OPENED', 'CLICKED', 'PAID', 'CLOSED', 'ERROR'].map((name) => [name, name.toLowerCase()])
);
const productionUnit = 'ca-app-pub-2292299294214510/8726265265';
const paid = (value = 0.004567, precision = 3, currency = 'USD') => ({value, precision, currency});

function fixture(t, {dev = false, show, load, diagnostics, online = true, refresh, foreground = true,
    gatherConsent = async () => ({canRequestAds: true}),
    getConsentInfo = async () => ({canRequestAds: true}),
    showPrivacyOptionsForm = async () => {}, initialize = async () => {},
    entitlement = () => ({ready: true, adsRemoved: false})} = {}) {
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
    const foregroundListeners = new Set();
    const networkListeners = new Set();
    const {AdMobAdGateway} = loadTypeScript('data/services/AdMobAdGateway.ts', {
        'react-native': {Platform: {OS: 'android'}},
        'react-native-google-mobile-ads': {
            __esModule: true,
            default: () => ({setRequestConfiguration: async () => {}, initialize}),
            AdsConsent: {gatherConsent, getConsentInfo, showPrivacyOptionsForm},
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
                        destroyCount: 0,
                        show: show ?? (async () => {}),
                        load: load ?? (() => {}),
                        addAdEventListener: (event, listener) => {
                            const set = listeners.get(event) ?? new Set();
                            listeners.set(event, set);
                            set.add(listener);
                            return () => set.delete(listener);
                        },
                        emit: (event, payload) => {
                            listeners.get(event)?.forEach(listener => listener(payload));
                        },
                        callbacks: event => [...(listeners.get(event) ?? [])],
                        destroy: () => {
                            ad.destroyCount += 1;
                            for (const set of listeners.values()) set.clear();
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
        '../datasources/platform/ForegroundWatcher': {
            isForeground: () => foreground,
            watchForeground: (listener) => {
                foregroundListeners.add(listener);
                return () => foregroundListeners.delete(listener);
            },
        },
    });
    const methods = ['trackLoaded', 'trackDisplayed', 'trackOpened', 'trackFailedToLoad', 'trackImpression'];
    const gateway = new AdMobAdGateway({
        diagnostics,
        network: {
            isOnline: () => online,
            ...(refresh ? {refresh: async () => { online = await refresh(online); return online; }} : {}),
            subscribe: (listener) => {
                networkListeners.add(listener);
                return () => networkListeners.delete(listener);
            },
        },
        analytics: {trackEvent: (name, data) => analytics.push({name, data})},
        adRevenue: Object.fromEntries(methods.map((method) => [method, (data) => tracked.push({method, data})])),
        entitlement,
    });
    return {gateway, ads, tracked, analytics,
        setOnline(value) {
            online = value;
            for (const listener of networkListeners) listener();
        },
        setForeground(value) {
            foreground = value;
            if (value) for (const listener of [...foregroundListeners]) listener();
        },
    };
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
    assert.equal(ad.destroyCount, 1);
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
    await Promise.resolve();
    assert.equal(ad.destroyCount, 1);
    t.mock.timers.tick(30000);
    assert.equal(ads.length, 2);
    assert.equal(ad.count(), 0);
    assert.equal(ad.destroyCount, 1);
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
    t.mock.timers.tick(59999);
    assert.equal(ad.destroyCount, 0);
    ad.emit('paid', paid());
    ad.emit('paid', paid());
    const revenue = tracked.filter(({method}) => method === 'trackImpression');
    assert.equal(revenue.length, 1);
    assert.equal(revenue[0].data.impressionId, firstContext.impressionId);
    assert.equal(ad.count(), 0);
    await Promise.resolve();
    assert.equal(ad.destroyCount, 1);
    t.mock.timers.tick(60000);
    await Promise.resolve();
    assert.equal(ad.destroyCount, 1);
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
    t.mock.timers.tick(59999);
    await Promise.resolve();
    assert.equal(ad.count('paid'), 1);
    assert.equal(ad.destroyCount, 0);
    t.mock.timers.tick(1);
    await Promise.resolve();
    assert.equal(ad.count(), 0);
    assert.equal(ad.destroyCount, 1);
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
    assert.equal(ad.destroyCount, 0);
    ad.emit('clicked');
    ad.emit('paid', paid());
    await Promise.resolve();
    assert.equal(ad.destroyCount, 0);
    ad.emit('closed');
    assert.deepEqual(tracked.map(({method}) => method), [
        'trackLoaded', 'trackDisplayed', 'trackOpened', 'trackImpression',
    ]);
    assert.equal(ad.count(), 0);
    await Promise.resolve();
    assert.equal(ad.destroyCount, 1);
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
    assert.equal(ad.destroyCount, 1);
});

test('show rejection is not mislabeled as a load failure and releases tracking after grace', async (t) => {
    const {gateway, ads, tracked} = fixture(t, {show: async () => { throw new Error('show failed'); }});
    await gateway.init();
    const ad = ads[0];
    ad.emit('loaded');
    assert.equal(await gateway.show('movie_open'), false);
    assert.deepEqual(tracked.map(({method}) => method), ['trackLoaded']);
    t.mock.timers.tick(60000);
    await Promise.resolve();
    assert.equal(ad.count(), 0);
    assert.equal(ad.destroyCount, 1);
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

function diagnosticRecorder() {
    const records = [];
    return {records, diagnostics: {start(operation) {
        const record = {operation};
        records.push(record);
        return {finish(outcome = 'ok', attributes) {
            if (!record.outcome) Object.assign(record, {outcome, attributes});
        }, fail(error, attributes) {
            if (!record.outcome) Object.assign(record, {outcome: 'error', error, attributes});
        }};
    }}};
}

for (const code of ['googleMobileAds/no-fill', 'googleMobileAds/mediation-no-fill']) {
    test(`ad diagnostics classify ${code} as an empty auction without an issue`, async (t) => {
        const {diagnostics, records} = diagnosticRecorder();
        const {gateway, ads} = fixture(t, {diagnostics});
        await gateway.init();
        ads[0].emit('error', {code, message: 'private SDK data'});
        const load = records.find(record => record.operation === 'ads.load');
        assert.equal(load.outcome, 'empty');
        assert.equal(load.error, undefined);
        assert.deepEqual(load.attributes, {error_code: 'no_fill'});
        assert.doesNotMatch(JSON.stringify(records), /private|ca-app-pub/);
    });
}

test('background ad presentation is unavailable without reporting an exception', async (t) => {
    const {diagnostics, records} = diagnosticRecorder();
    const {gateway, ads} = fixture(t, {diagnostics, show: async () => {
        throw {code: 'googleMobileAds/app-not-foreground', message: 'private SDK data'};
    }});
    await gateway.init();
    ads[0].emit('loaded');
    assert.equal(await gateway.show('movie_open'), false);
    const present = records.find(record => record.operation === 'ads.present');
    assert.equal(present.outcome, 'unavailable');
    assert.equal(present.error, undefined);
    assert.deepEqual(present.attributes, {error_code: 'app_not_foreground'});
});

test('offline initialization waits for connectivity before preloading and does not duplicate loads', async (t) => {
    const {gateway, ads, setOnline} = fixture(t, {online: false});
    await gateway.init();
    t.mock.timers.tick(300000);
    assert.equal(ads.length, 0);
    setOnline(true);
    setOnline(true);
    assert.equal(ads.length, 1);
});

test('confirmed offline internal load failure waits for reconnection and retains failure tracking', async (t) => {
    const {diagnostics, records} = diagnosticRecorder();
    const {gateway, ads, tracked, setOnline} = fixture(t, {diagnostics});
    await gateway.init();
    setOnline(false);
    ads[0].emit('error', {code: 'googleMobileAds/internal-error'});
    const load = records.find(record => record.operation === 'ads.load');
    assert.equal(load.outcome, 'unavailable');
    assert.deepEqual(load.attributes, {error_code: 'network_error'});
    assert.deepEqual(tracked.map(({method}) => method), ['trackFailedToLoad']);
    t.mock.timers.tick(300000);
    assert.equal(ads.length, 1);
    setOnline(true);
    assert.equal(ads.length, 2);
});

test('online internal failures and offline invalid requests still report real ad errors', async (t) => {
    const {diagnostics, records} = diagnosticRecorder();
    const {gateway, ads, setOnline} = fixture(t, {diagnostics});
    await gateway.init();
    ads[0].emit('error', {code: 'googleMobileAds/internal-error'});
    assert.equal(records.at(-1).outcome, 'error');
    assert.deepEqual(records.at(-1).attributes, {error_code: 'internal_error'});
    t.mock.timers.tick(30000);
    setOnline(false);
    ads[1].emit('error', {code: 'googleMobileAds/invalid-request'});
    assert.equal(records.at(-1).outcome, 'error');
    assert.deepEqual(records.at(-1).attributes, {error_code: 'invalid_request'});
});

test('structured Ads17 failures preserve provider errors and recovery without deprecated codes', async t => {
    const {diagnostics, records} = diagnosticRecorder();
    const {gateway, ads, tracked} = fixture(t, {diagnostics});
    await gateway.init();
    ads[0].emit('error', {reason: 'no-fill', phase: 'load'});
    assert.equal(records.at(-1).outcome, 'empty');
    t.mock.timers.tick(30000);
    const error = {reason: 'internal-error', phase: 'load', responseInfo: {adapterResponses: [
        {outcome: 'error', adError: {domain: 'com.google.android.gms.ads', code: 2, message: 'private details'}},
    ]}};
    ads[1].emit('error', error);
    assert.equal(records.at(-1).outcome, 'error');
    assert.equal(records.at(-1).error, error);
    assert.deepEqual(records.at(-1).attributes, {error_code: 'internal_error', stage: 'load',
        ad_adapter_count: 1, ad_adapter_error_count: 1, ad_adapter_error_code: 2, ad_error_domain: 'admob'});
    assert.equal(tracked.filter(item => item.method === 'trackFailedToLoad').length, 2);
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(ads[1].destroyCount, 1);
    t.mock.timers.tick(59999);
    assert.equal(ads.length, 2);
    t.mock.timers.tick(1);
    assert.equal(ads.length, 3);
    ads[2].emit('loaded');
    assert.equal(records.at(-1).outcome, 'ok');
});

test('background retries pause and resume once in the foreground', async (t) => {
    const {gateway, ads, setForeground} = fixture(t, {foreground: false});
    await gateway.init();
    assert.equal(ads.length, 0);
    setForeground(true);
    ads[0].emit('error', {code: 'googleMobileAds/no-fill'});
    setForeground(false);
    t.mock.timers.tick(30000);
    assert.equal(ads.length, 1);
    setForeground(true);
    setForeground(true);
    assert.equal(ads.length, 2);
});

test('going offline cancels an outstanding retry without foreground events bypassing backoff', async (t) => {
    const {gateway, ads, setForeground, setOnline} = fixture(t);
    await gateway.init();
    ads[0].emit('error', {code: 'googleMobileAds/no-fill'});
    setForeground(true);
    assert.equal(ads.length, 1);
    setOnline(false);
    t.mock.timers.tick(300000);
    assert.equal(ads.length, 1);
    setOnline(true);
    assert.equal(ads.length, 2);
});

test('known supporters never preload or retry ads, while a later free entitlement permits loading', async (t) => {
    let state = {ready: true, adsRemoved: true};
    const {gateway, ads, setForeground} = fixture(t, {entitlement: () => state});
    await gateway.init();
    setForeground(true);
    assert.equal(ads.length, 0);
    state = {ready: true, adsRemoved: false};
    setForeground(true);
    assert.equal(ads.length, 1);
    state = {ready: true, adsRemoved: true};
    ads[0].emit('error', {code: 'googleMobileAds/no-fill'});
    t.mock.timers.tick(300000);
    assert.equal(ads.length, 1);
});

test('ads check fresh connectivity before loading and share the in-flight refresh', async (t) => {
    let resolve;
    const {gateway, ads, setForeground} = fixture(t, {refresh: () => new Promise(done => { resolve = done; })});
    await gateway.init();
    setForeground(true);
    assert.equal(ads.length, 0);
    resolve(false);
    await new Promise(done => setImmediate(done));
    assert.equal(ads.length, 0);
});

test('generic ad load failures refresh delayed connectivity without hiding real online failures', async (t) => {
    let connection = true;
    const {diagnostics, records} = diagnosticRecorder();
    const {gateway, ads, tracked, setOnline} = fixture(t, {diagnostics, refresh: async () => connection});
    await gateway.init();
    await new Promise(done => setImmediate(done));
    connection = false;
    ads[0].emit('error', {code: 'googleMobileAds/internal-error'});
    await new Promise(done => setImmediate(done));
    const first = records.find(record => record.operation === 'ads.load');
    assert.equal(first.outcome, 'unavailable');
    assert.equal(first.attributes.error_code, 'network_error');
    assert.equal(tracked.filter(entry => entry.method === 'trackFailedToLoad').length, 1);
    t.mock.timers.tick(300000);
    assert.equal(ads.length, 1);
    connection = true;
    setOnline(true);
    await new Promise(done => setImmediate(done));
    ads[1].emit('error', {code: 'googleMobileAds/internal-error'});
    await new Promise(done => setImmediate(done));
    assert.equal(records.at(-1).outcome, 'error');
    assert.equal(records.at(-1).attributes.error_code, 'internal_error');
});

test('a synchronous native ad load failure releases listeners and retries without rejecting init', async (t) => {
    const error = Object.assign(new Error('Native load failed'), {code: 'googleMobileAds/invalid-request'});
    let fail = true;
    const {diagnostics, records} = diagnosticRecorder();
    const {gateway, ads, tracked} = fixture(t, {diagnostics, load: () => { if (fail) throw error; }});
    await assert.doesNotReject(gateway.init());
    assert.equal(records.at(-1).error, error);
    assert.equal(records.at(-1).operation, 'ads.load');
    assert.equal(ads[0].count(), 0);
    assert.equal(ads[0].destroyCount, 1);
    assert.equal(tracked.filter(entry => entry.method === 'trackFailedToLoad').length, 1);
    fail = false;
    t.mock.timers.tick(30000);
    assert.equal(ads.length, 2);
    ads[1].emit('loaded');
    assert.equal(tracked.at(-1).method, 'trackLoaded');
});

test('becoming a supporter while the preload connectivity read waits cancels the request', async t => {
    let state = {ready: true, adsRemoved: false};
    let resolve;
    const f = fixture(t, {entitlement: () => state, refresh: () => new Promise(done => {resolve = done;})});
    await f.gateway.init();
    state = {ready: true, adsRemoved: true};
    resolve(true);
    await new Promise(done => setImmediate(done));
    assert.equal(f.ads.length, 0);
    f.setForeground(true);
    assert.equal(f.ads.length, 0);
    state = {ready: true, adsRemoved: false};
    f.setForeground(true);
    resolve(true);
    await new Promise(done => setImmediate(done));
    assert.equal(f.ads.length, 1);
});

test('pending failure connectivity read cannot permit stale success or duplicate retries', async t => {
    let reads = 0;
    let resolve;
    const f = fixture(t, {refresh: async () => ++reads === 2 ? new Promise(done => {resolve = done;}) : true});
    await f.gateway.init();
    await new Promise(done => setImmediate(done));
    const old = f.ads[0];
    old.emit('error', {code: 'googleMobileAds/internal-error'});
    old.emit('loaded');
    old.emit('error', {code: 'googleMobileAds/internal-error'});
    f.setForeground(true);
    f.setOnline(true);
    assert.equal(f.ads.length, 1);
    assert.equal(f.gateway.show('movie_open'), null);
    resolve(true);
    await new Promise(done => setImmediate(done));
    assert.equal(old.count(), 0);
    assert.equal(f.tracked.filter(item => item.method === 'trackFailedToLoad').length, 1);
    assert.equal(f.tracked.filter(item => item.method === 'trackLoaded').length, 0);
    t.mock.timers.tick(30000);
    await new Promise(done => setImmediate(done));
    assert.equal(f.ads.length, 2);
    old.emit('loaded');
    old.emit('error', {code: 'googleMobileAds/invalid-request'});
    f.ads[1].emit('loaded');
    assert.equal(f.tracked.filter(item => item.method === 'trackLoaded').length, 1);
    assert.equal(f.ads.length, 2);
});

function deferred() {
    let resolve;
    let reject;
    const promise = new Promise((done, fail) => { resolve = done; reject = fail; });
    return {promise, resolve, reject};
}

const flush = () => new Promise(done => setImmediate(done));

test('privacy withdrawal discards a cached ad and blocks future shows and reconnect loads', async t => {
    let shows = 0;
    const f = fixture(t, {
        show: async () => { shows++; },
        getConsentInfo: async () => ({canRequestAds: false, privacyOptionsRequirementStatus: 'REQUIRED'}),
    });
    await f.gateway.init();
    const old = f.ads[0];
    old.emit('loaded');
    await f.gateway.showPrivacyOptions();
    assert.equal(old.destroyCount, 1);
    assert.equal(old.count(), 0);
    assert.equal(f.gateway.privacyOptionsRequired(), true);
    assert.equal(f.gateway.show('movie_open'), null);
    f.setForeground(true);
    f.setOnline(false);
    f.setOnline(true);
    t.mock.timers.tick(300000);
    assert.equal(f.ads.length, 1);
    assert.equal(shows, 0);
});

test('privacy updates share one form and suspend initialization, queued events and retries', async t => {
    const form = deferred();
    let forms = 0;
    const f = fixture(t, {showPrivacyOptionsForm: () => { forms++; return form.promise; }});
    await f.gateway.init();
    const staleLoaded = f.ads[0].callbacks('loaded');
    const stalePaid = f.ads[0].callbacks('paid');
    const first = f.gateway.showPrivacyOptions();
    const second = f.gateway.showPrivacyOptions();
    assert.equal(first, second);
    assert.equal(f.gateway.init(), first);
    await flush();
    assert.equal(forms, 1);
    for (const listener of staleLoaded) listener();
    for (const listener of stalePaid) listener(paid());
    assert.equal(f.gateway.show('movie_open'), null);
    f.setForeground(true);
    f.setOnline(true);
    t.mock.timers.tick(300000);
    assert.equal(f.ads.length, 1);
    assert.equal(f.tracked.length, 0);
    form.resolve();
    await first;
    assert.equal(f.ads.length, 2);
    assert.equal(f.ads[0].destroyCount, 1);
    assert.equal(f.gateway.show('movie_open'), null);
    f.ads[1].emit('loaded');
    const shown = f.gateway.show('movie_open');
    assert.ok(shown instanceof Promise);
    f.ads[1].emit('closed');
    await shown;
});

test('withdrawing while a retry is scheduled cancels it', async t => {
    const f = fixture(t, {getConsentInfo: async () => ({canRequestAds: false})});
    await f.gateway.init();
    f.ads[0].emit('error', {reason: 'no-fill'});
    await f.gateway.showPrivacyOptions();
    t.mock.timers.tick(300000);
    assert.equal(f.ads.length, 1);
});

test('a pre-consent connectivity response cannot clear or duplicate the replacement preload', async t => {
    const oldRead = deferred();
    const freshRead = deferred();
    let reads = 0;
    const f = fixture(t, {refresh: () => ++reads === 1 ? oldRead.promise : freshRead.promise});
    await f.gateway.init();
    await f.gateway.showPrivacyOptions();
    assert.equal(reads, 2);
    oldRead.resolve(true);
    await flush();
    f.setForeground(true);
    f.setOnline(true);
    assert.equal(reads, 2);
    assert.equal(f.ads.length, 0);
    freshRead.resolve(true);
    await flush();
    assert.equal(f.ads.length, 1);
});

test('a pending old load failure cannot destroy a replacement ad after privacy changes', async t => {
    const failureRead = deferred();
    let reads = 0;
    const f = fixture(t, {refresh: () => ++reads === 2 ? failureRead.promise : Promise.resolve(true)});
    await f.gateway.init();
    await flush();
    f.ads[0].emit('error', {reason: 'internal-error'});
    await f.gateway.showPrivacyOptions();
    await flush();
    assert.equal(f.ads.length, 2);
    const replacement = f.ads[1];
    replacement.emit('loaded');
    failureRead.resolve(true);
    await flush();
    t.mock.timers.tick(300000);
    assert.equal(replacement.destroyCount, 0);
    assert.equal(f.ads.length, 2);
    assert.deepEqual(f.tracked.map(item => item.method), ['trackLoaded']);
});

test('a privacy form failure still refreshes consent instead of reusing permission', async t => {
    const f = fixture(t, {
        showPrivacyOptionsForm: async () => { throw new Error('form failed'); },
        getConsentInfo: async () => ({canRequestAds: false}),
    });
    await f.gateway.init();
    f.ads[0].emit('loaded');
    await assert.doesNotReject(f.gateway.showPrivacyOptions());
    assert.equal(f.gateway.show('movie_open'), null);
    f.setForeground(true);
    assert.equal(f.ads.length, 1);
});

test('unreadable refreshed consent fails closed and another explicit privacy attempt can recover', async t => {
    let unavailable = true;
    const f = fixture(t, {getConsentInfo: async () => {
        if (unavailable) throw new Error('consent unavailable');
        return {canRequestAds: true};
    }});
    await f.gateway.init();
    f.ads[0].emit('loaded');
    await f.gateway.showPrivacyOptions();
    f.setForeground(true);
    assert.equal(f.gateway.show('movie_open'), null);
    assert.equal(f.ads.length, 1);
    unavailable = false;
    await f.gateway.showPrivacyOptions();
    assert.equal(f.ads.length, 2);
});

test('privacy choices wait for an in-flight initial consent form and override its result', async t => {
    const consent = deferred();
    let forms = 0;
    let initialized = 0;
    const f = fixture(t, {
        gatherConsent: () => consent.promise,
        showPrivacyOptionsForm: async () => { forms++; },
        getConsentInfo: async () => ({canRequestAds: false}),
        initialize: async () => { initialized++; },
    });
    const initial = f.gateway.init();
    const update = f.gateway.showPrivacyOptions();
    await flush();
    assert.equal(forms, 0);
    consent.resolve({canRequestAds: true});
    await Promise.all([initial, update]);
    await f.gateway.init();
    assert.equal(forms, 1);
    assert.equal(initialized, 0);
    assert.equal(f.ads.length, 0);
});

test('privacy approval initializes ads after initial consent refusal', async t => {
    let initialized = 0;
    const f = fixture(t, {
        gatherConsent: async () => ({canRequestAds: false}),
        getConsentInfo: async () => ({canRequestAds: true, privacyOptionsRequirementStatus: 'NOT_REQUIRED'}),
        initialize: async () => { initialized++; },
    });
    await f.gateway.init();
    assert.equal(f.ads.length, 0);
    await f.gateway.showPrivacyOptions();
    await f.gateway.init();
    assert.equal(initialized, 1);
    assert.equal(f.ads.length, 1);
    assert.equal(f.gateway.privacyOptionsRequired(), false);
});

test('privacy changes during SDK initialization block the old initialization preload', async t => {
    const initialization = deferred();
    let initialized = 0;
    let forms = 0;
    const f = fixture(t, {
        initialize: () => { initialized++; return initialization.promise; },
        showPrivacyOptionsForm: async () => { forms++; },
        getConsentInfo: async () => ({canRequestAds: false}),
    });
    const initial = f.gateway.init();
    await flush();
    const update = f.gateway.showPrivacyOptions();
    assert.equal(f.gateway.init(), update);
    await flush();
    assert.equal(forms, 0);
    initialization.resolve();
    await Promise.all([initial, update]);
    f.setForeground(true);
    assert.equal(initialized, 1);
    assert.equal(forms, 1);
    assert.equal(f.ads.length, 0);
});

test('a failed SDK initialization after privacy approval stays blocked until a fresh attempt succeeds', async t => {
    let failing = true;
    const f = fixture(t, {
        gatherConsent: async () => ({canRequestAds: false}),
        initialize: async () => { if (failing) throw new Error('SDK init failed'); },
    });
    await f.gateway.init();
    await assert.doesNotReject(f.gateway.showPrivacyOptions());
    f.setForeground(true);
    assert.equal(f.gateway.show('movie_open'), null);
    assert.equal(f.ads.length, 0);
    failing = false;
    await f.gateway.showPrivacyOptions();
    assert.equal(f.ads.length, 1);
});

test('privacy options never cover an active ad, including after its navigation timeout', async t => {
    let forms = 0;
    const f = fixture(t, {showPrivacyOptionsForm: async () => { forms++; }});
    await f.gateway.init();
    const ad = f.ads[0];
    ad.emit('loaded');
    const shown = f.gateway.show('movie_open');
    ad.emit('opened');
    await f.gateway.showPrivacyOptions();
    assert.equal(forms, 0);
    t.mock.timers.tick(8000);
    await shown;
    await f.gateway.showPrivacyOptions();
    assert.equal(forms, 0);
    assert.equal(f.ads.length, 1);
    ad.emit('closed');
    await f.gateway.showPrivacyOptions();
    assert.equal(forms, 1);
});
