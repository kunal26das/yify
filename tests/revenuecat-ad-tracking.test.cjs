const assert = require('node:assert/strict');
const {test} = require('node:test');
const {loadTypeScript} = require('./helpers/load-typescript.cjs');

const impression = {
    adUnitId: 'unit-1', impressionId: 'impression-1', placement: 'movie_open',
};
const base = {
    mediatorName: 'AdMob', adFormat: 'interstitial', ...impression, networkName: undefined,
};
const revenue = {...impression, value: 0.0012345, currency: 'USD', precision: 'estimated'};
const methods = ['trackAdLoaded', 'trackAdDisplayed', 'trackAdOpened', 'trackAdRevenue', 'trackAdFailedToLoad'];

function fixture(override = {}) {
    const calls = [];
    const diagnostics = [];
    const adTracker = Object.fromEntries(methods.map(method => [method, async data => {
        calls.push({method, data});
    }]));
    Object.assign(adTracker, override);
    const {RevenueCatAdRevenueSink} = loadTypeScript('data/services/RevenueCatAdRevenueSink.ts', {
        'react-native-purchases': {
            __esModule: true,
            default: {
                adTracker,
                getCustomerInfo: () => { throw Error('Purchase details are still unavailable'); },
            },
            AdMediatorName: {adMob: 'AdMob'},
            AdFormat: {interstitial: 'interstitial'},
        },
    });
    const sink = new RevenueCatAdRevenueSink({
        trackEvent: (name, params) => diagnostics.push({name, params}),
    });
    return {sink, calls, diagnostics};
}

test('RevenueCat receives each ad lifecycle event with the same impression and placement', async () => {
    const {sink, calls, diagnostics} = fixture();
    sink.trackLoaded(impression);
    sink.trackDisplayed(impression);
    sink.trackOpened(impression);
    sink.trackImpression(revenue);
    sink.trackFailedToLoad({adUnitId: 'unit-1', placement: 'movie_open', mediatorErrorCode: 3});
    await Promise.resolve();
    assert.deepEqual(calls, [
        {method: 'trackAdLoaded', data: base},
        {method: 'trackAdDisplayed', data: base},
        {method: 'trackAdOpened', data: base},
        {method: 'trackAdRevenue', data: {...base, revenueMicros: 1235, currency: 'USD', precision: 'estimated'}},
        {method: 'trackAdFailedToLoad', data: {
            mediatorName: 'AdMob', adFormat: 'interstitial', adUnitId: 'unit-1',
            placement: 'movie_open', mediatorErrorCode: 3,
        }},
    ]);
    assert.deepEqual(diagnostics, []);
});

test('ad tracking does not wait for purchase details and preserves optional network data', () => {
    const {sink, calls} = fixture();
    sink.trackLoaded({...impression, networkName: 'actual SDK network'});
    assert.equal(calls.length, 1);
    assert.equal(calls[0].data.networkName, 'actual SDK network');
});

test('installed RevenueCat bridge sends all ad events after configuration without waiting for customer info', async () => {
    const calls = [];
    const diagnostics = [];
    let configurationChecks = 0;
    let customerReads = 0;
    const native = {
        isConfigured: async () => { configurationChecks++; return true; },
        getCustomerInfo: () => { customerReads++; return new Promise(() => {}); },
        ...Object.fromEntries(methods.map(method => [method, data => calls.push({method, data})])),
    };
    const sdk = loadTypeScript('node_modules/react-native-purchases/dist/purchases.js', {
        'react-native': {
            NativeModules: {RNPurchases: native},
            NativeEventEmitter: class { addListener() {} },
            Platform: {OS: 'android'},
        },
        './utils/environment': {shouldUseBrowserMode: () => false},
        './browser/nativeModule': {},
    });
    const {RevenueCatAdRevenueSink} = loadTypeScript('data/services/RevenueCatAdRevenueSink.ts', {
        'react-native-purchases': sdk,
    });
    const sink = new RevenueCatAdRevenueSink({
        trackEvent: (name, params) => diagnostics.push({name, params}),
    });

    sink.trackLoaded(impression);
    sink.trackDisplayed(impression);
    sink.trackOpened(impression);
    sink.trackImpression(revenue);
    sink.trackFailedToLoad({adUnitId: impression.adUnitId, placement: impression.placement});
    await new Promise(resolve => setImmediate(resolve));

    assert.equal(configurationChecks, 5);
    assert.equal(customerReads, 0);
    assert.deepEqual(calls.map(({method}) => method), methods);
    assert.deepEqual(diagnostics, []);
});

test('revenue conversion retains zero and all reported precision types', () => {
    const {sink, calls} = fixture();
    for (const precision of ['unknown', 'estimated', 'publisher_defined', 'exact']) {
        sink.trackImpression({...revenue, value: 0, precision});
    }
    assert.equal(calls.length, 4);
    assert.deepEqual(calls.map(call => call.data.revenueMicros), [0, 0, 0, 0]);
    assert.deepEqual(calls.map(call => call.data.precision), ['unknown', 'estimated', 'publisher_defined', 'exact']);
});

test('invalid revenue is diagnosed without inventing amounts or currency', () => {
    const {sink, calls, diagnostics} = fixture();
    for (const value of [NaN, Infinity, -Infinity, -0.1, Number.MAX_VALUE]) {
        sink.trackImpression({...revenue, value});
    }
    for (const currency of ['', 'US', 'usd', 'USDD']) sink.trackImpression({...revenue, currency});
    assert.equal(calls.length, 0);
    assert.equal(diagnostics.length, 9);
    assert.ok(diagnostics.every(event => event.params.reason === 'invalid_payload'));
});

test('SDK rejection is observed without retrying a revenue event or exposing error details', async () => {
    let attempts = 0;
    const {sink, diagnostics} = fixture({trackAdRevenue: async () => {
        attempts++;
        throw Error('private SDK error data');
    }});
    assert.doesNotThrow(() => sink.trackImpression(revenue));
    await Promise.resolve();
    await Promise.resolve();
    assert.equal(attempts, 1);
    assert.deepEqual(diagnostics, [{name: 'ad_tracking_failed', params: {
        provider: 'revenuecat', event: 'revenue', reason: 'sdk',
    }}]);
});

test('a synchronous tracking failure never interrupts ad callbacks', () => {
    const {sink, diagnostics} = fixture({trackAdDisplayed: () => { throw Error('unavailable bridge'); }});
    assert.doesNotThrow(() => sink.trackDisplayed(impression));
    assert.equal(diagnostics[0].params.event, 'displayed');
    assert.equal(diagnostics[0].params.reason, 'sdk');
});

test('web ad tracking remains a no-op without loading the native SDK', () => {
    const {RevenueCatAdRevenueSink} = loadTypeScript('data/services/RevenueCatAdRevenueSink.web.ts');
    const sink = new RevenueCatAdRevenueSink({trackEvent: () => { throw Error('unexpected web event'); }});
    for (const method of ['trackLoaded', 'trackDisplayed', 'trackOpened', 'trackFailedToLoad']) {
        assert.doesNotThrow(() => sink[method](impression));
    }
    assert.doesNotThrow(() => sink.trackImpression(revenue));
});
