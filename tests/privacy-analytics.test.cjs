const assert = require('node:assert/strict');
const {test} = require('node:test');
const {loadTypeScript} = require('./helpers/load-typescript.cjs');
const {privacyFixture} = require('./helpers/privacy-fixture.cjs');
const flush = () => new Promise(resolve => setImmediate(resolve));
const deferred = () => {
    let resolve;
    const promise = new Promise(yes => { resolve = yes; });
    return {promise, resolve};
};

function nativeFixture(privacy, overrides = {}) {
    const calls = [];
    const analytics = {};
    const sdk = {
        getAnalytics: () => analytics,
        getAppInstanceId: async () => 'installation-id',
        logEvent: async (_, name, params) => calls.push(['event', name, params]),
        logScreenView: (_, params) => { calls.push(['screen', params]); },
        setUserProperty: async (_, name, value) => calls.push(['property', name, value]),
        resetAnalyticsData: async () => calls.push(['reset']),
        setAnalyticsCollectionEnabled: async (_, enabled) => calls.push(['enabled', enabled]),
        setConsent: async (_, consent) => calls.push(['consent', consent]),
        ...overrides,
    };
    const module = loadTypeScript('data/datasources/analytics/FirebaseAnalyticsSink.ts', {
        '@react-native-firebase/analytics': sdk,
        '@react-native-firebase/crashlytics': {getCrashlytics() { throw Error('Analytics must not write crash breadcrumbs'); }},
    });
    return {calls, sink: new module.FirebaseAnalyticsSink(privacy), getId: () => module.getAnalyticsInstanceId(privacy)};
}

test('native analytics drops pre-consent data, enables only for adults, and resets on withdrawal', async () => {
    const privacy = privacyFixture(false, false);
    const f = nativeFixture(privacy);
    f.sink.trackEvent('private_before_choice', {search_term: 'private'});
    f.sink.setUserProperty('state', 'before');
    await flush();
    assert.ok(f.calls.some(([kind]) => kind === 'reset'));
    assert.equal(f.calls.some(([kind]) => kind === 'event' || kind === 'property'), false);
    assert.equal(await f.getId(), null);
    privacy.updateChoices({adultConfirmed: true, analytics: true});
    await flush();
    f.sink.trackEvent('allowed');
    f.sink.trackScreenView('/movies');
    assert.equal(await f.getId(), 'installation-id');
    assert.ok(f.calls.some(([kind, name]) => kind === 'event' && name === 'allowed'));
    privacy.updateChoices({analytics: false});
    f.sink.trackEvent('after_withdrawal');
    await flush();
    assert.equal(await f.getId(), null);
    assert.equal(f.calls.some(([kind, name]) => kind === 'event' && name === 'after_withdrawal'), false);
    assert.equal(f.calls.filter(([kind]) => kind === 'reset').length, 2);
    assert.deepEqual(f.calls.filter(([kind]) => kind === 'consent').at(-1)[1], {
        analytics_storage: false, ad_storage: false, ad_user_data: false, ad_personalization: false,
    });
});

test('native consent withdrawal wins over a pending enable and does not expose a stale installation ID', async () => {
    const privacy = privacyFixture(true);
    const enable = deferred();
    const f = nativeFixture(privacy, {setAnalyticsCollectionEnabled: async (_, enabled) => {
        if (enabled) await enable.promise;
    }});
    await flush();
    privacy.updateChoices({analytics: false});
    enable.resolve();
    await flush();
    f.sink.trackEvent('stale');
    assert.equal(f.calls.some(([kind]) => kind === 'event'), false);
    assert.equal(await f.getId(), null);
    assert.ok(f.calls.some(([kind]) => kind === 'reset'));
});

test('a quick withdrawal and regrant still resets the former installation data', async () => {
    const privacy = privacyFixture(true);
    const f = nativeFixture(privacy);
    await flush();
    privacy.updateChoices({analytics: false});
    privacy.updateChoices({analytics: true});
    await flush();
    assert.ok(f.calls.some(([kind]) => kind === 'reset'));
    assert.equal(await f.getId(), 'installation-id');
});

function webFixture(t, privacy, supported = async () => true, sdkOverrides = {}) {
    for (const [key, value] of Object.entries({
        navigator: {userAgent: 'Mozilla/5.0'},
        window: {location: {origin: 'https://yify.expo.app', hostname: 'yify.expo.app', pathname: '/movies', search: '?query=private', hash: '#secret'}},
        document: {cookie: ''},
    })) {
        const descriptor = Object.getOwnPropertyDescriptor(globalThis, key);
        Object.defineProperty(globalThis, key, {configurable: true, value});
        t.after(() => {
            if (descriptor) Object.defineProperty(globalThis, key, descriptor);
            else delete globalThis[key];
        });
    }
    const calls = [];
    const cookies = [];
    Object.defineProperty(document, 'cookie', {get: () => '', set: value => cookies.push(value)});
    const app = {options: {measurementId: 'G-TEST'}};
    const {FirebaseAnalyticsSink} = loadTypeScript('data/datasources/analytics/FirebaseAnalyticsSink.web.ts', {
        'firebase/analytics': {
            isSupported: () => { calls.push(['supported']); return supported(); },
            initializeAnalytics: (_, options) => { calls.push(['initialize', options]); return {app}; },
            logEvent: (_, name, params) => calls.push(['event', name, params]),
            setAnalyticsCollectionEnabled: (_, enabled) => calls.push(['enabled', enabled]),
            setConsent: consent => calls.push(['consent', consent]),
            setUserProperties: (_, properties) => calls.push(['properties', properties]),
            ...sdkOverrides,
        },
        '../firebase/FirebaseWebApp': {getFirebaseApp: () => app, getFirebaseMeasurementId: () => app.options.measurementId},
    });
    return {sink: new FirebaseAnalyticsSink(privacy), calls, cookies};
}

test('web does not initialize or buffer before consent and disables collection on withdrawal', async t => {
    const privacy = privacyFixture(false);
    const f = webFixture(t, privacy);
    f.sink.trackEvent('before', {secret: 'private'});
    f.sink.trackScreenView('/before');
    f.sink.setUserProperty('before', 'private');
    await flush();
    assert.deepEqual(f.calls, []);
    assert.equal(window['ga-disable-G-TEST'], true);
    assert.ok(f.cookies.some(cookie => cookie.startsWith('_ga_TEST=; Max-Age=0')));
    privacy.updateChoices({analytics: true});
    await flush();
    assert.equal(window['ga-disable-G-TEST'], false);
    f.sink.trackEvent('after', {value: 1});
    assert.equal(f.calls.filter(([kind]) => kind === 'initialize').length, 1);
    assert.deepEqual(f.calls.filter(([kind]) => kind === 'event'), [['event', 'after', {
        value: 1, page_location: 'https://yify.expo.app/movies', page_referrer: '',
    }]]);
    const init = f.calls.find(([kind]) => kind === 'initialize')[1];
    assert.equal(init.config.send_page_view, false);
    assert.equal(init.config.allow_google_signals, false);
    privacy.updateChoices({analytics: false});
    f.sink.trackEvent('withdrawn');
    assert.equal(window['ga-disable-G-TEST'], true);
    assert.equal(f.calls.some(([kind]) => kind === 'enabled'), false);
    assert.equal(f.calls.filter(([kind]) => kind === 'event').length, 1);
    assert.ok(f.cookies.some(cookie => cookie.startsWith('_ga_TEST=; Max-Age=0')));
});

test('web withdrawal during capability detection prevents late initialization', async t => {
    const privacy = privacyFixture(true);
    const supported = deferred();
    const f = webFixture(t, privacy, () => supported.promise);
    privacy.updateChoices({analytics: false});
    assert.equal(window['ga-disable-G-TEST'], true);
    supported.resolve(true);
    await flush();
    assert.equal(f.calls.some(([kind]) => kind === 'initialize' || kind === 'consent'), false);
});

test('web withdrawal blocks delayed Google config and already queued events before SDK initialization finishes', async t => {
    const privacy = privacyFixture(true);
    const initialization = deferred();
    const sent = [];
    const f = webFixture(t, privacy, async () => true, {
        initializeAnalytics: () => {
            void initialization.promise.then(() => {
                if (window['ga-disable-G-TEST'] !== true) sent.push('config');
            });
            return {app: {options: {measurementId: 'G-TEST'}}};
        },
        logEvent: (_, name) => {
            void initialization.promise.then(() => {
                if (window['ga-disable-G-TEST'] !== true) sent.push(name);
            });
        },
        setAnalyticsCollectionEnabled: (_, enabled) => {
            void initialization.promise.then(() => { window['ga-disable-G-TEST'] = !enabled; });
        },
    });
    await flush();
    f.sink.trackEvent('queued_while_allowed');
    privacy.updateChoices({analytics: false});
    assert.equal(window['ga-disable-G-TEST'], true);
    initialization.resolve();
    await flush();
    assert.deepEqual(sent, []);
    assert.equal(window['ga-disable-G-TEST'], true);
    privacy.updateChoices({analytics: true});
    await flush();
    f.sink.trackEvent('new_allowed_event');
    await flush();
    assert.deepEqual(sent, ['new_allowed_event']);
});

test('another browser tab withdrawing consent sets the Google disable flag synchronously', async t => {
    const {PrivacyPreferencesImpl} = loadTypeScript('data/services/PrivacyPreferencesImpl.ts');
    let stored = JSON.stringify({adultConfirmed: true, analytics: true,
        noticeVersion: '2026-09-25', updatedAt: '2026-09-25T00:00:00.000Z'});
    let storageChanged;
    const privacy = new PrivacyPreferencesImpl({
        getString: () => stored, set: (_, value) => { stored = value; }, delete: () => { stored = undefined; },
    }, listener => { storageChanged = listener; });
    webFixture(t, privacy);
    await flush();
    assert.equal(window['ga-disable-G-TEST'], false);
    stored = undefined;
    storageChanged();
    assert.equal(window['ga-disable-G-TEST'], true);
});

test('search analytics contains counts and no free-text query', () => {
    const calls = [];
    const {Analytics, installAnalyticsSink} = loadTypeScript('presentation/analytics/events.ts', {
        'react-native': {Platform: {OS: 'android'}}, '@/domain': {},
    });
    installAnalyticsSink({trackEvent: (...args) => calls.push(args)});
    Analytics.search('person@example.test private phrase', 4);
    assert.deepEqual(calls, [['search', {query_length: 34, result_count: 4}]]);
    assert.doesNotMatch(JSON.stringify(calls), /person|private|search_term/);
});
