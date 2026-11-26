const assert = require('node:assert/strict');
const {test} = require('node:test');
const {loadTs} = require('../../../../tests/helpers/loadTs.cjs');

function firebaseMock() {
  const calls = [];
  const record = (name) => (...args) => {
    calls.push([name, ...args.slice(1)]);
    return Promise.resolve(name === 'getAppInstanceId' ? 'app-instance' : undefined);
  };
  return {
    calls,
    module: {
      getAnalytics: () => ({}),
      getAppInstanceId: record('getAppInstanceId'),
      logEvent: record('logEvent'),
      logScreenView: record('logScreenView'),
      resetAnalyticsData: record('resetAnalyticsData'),
      setAnalyticsCollectionEnabled: record('setAnalyticsCollectionEnabled'),
      setConsent: record('setConsent'),
      setUserProperties: record('setUserProperties'),
    },
  };
}

const flush = async () => {
  for (let index = 0; index < 10; index += 1) await new Promise((resolve) => setTimeout(resolve, 0));
};

test('native analytics stays off and resets without consent, and logs only after it is granted', async () => {
  const firebase = firebaseMock();
  const analytics = loadTs('src/core/platform/telemetry/analytics.ts', {'@react-native-firebase/analytics': firebase.module});
  analytics.applyAnalyticsConsent(false);
  await flush();
  analytics.logAnalyticsEvent('search', {query_length: 4});
  assert.deepEqual(firebase.calls.map(([name]) => name), ['setAnalyticsCollectionEnabled', 'setConsent', 'resetAnalyticsData']);
  assert.deepEqual(firebase.calls[1][1], {analytics_storage: false, ad_storage: false, ad_user_data: false, ad_personalization: false});
  assert.equal(await analytics.analyticsInstanceId(), null);
  firebase.calls.length = 0;
  analytics.applyAnalyticsConsent(true);
  await flush();
  assert.equal(analytics.analyticsEnabled(), true);
  analytics.logAnalyticsEvent('search', {query_length: 4});
  analytics.logAnalyticsScreen('home');
  analytics.setAnalyticsUserProperties({plus: 'false'});
  assert.equal(await analytics.analyticsInstanceId(), 'app-instance');
  assert.deepEqual(firebase.calls.map(([name]) => name), [
    'setAnalyticsCollectionEnabled', 'setConsent', 'setAnalyticsCollectionEnabled', 'logEvent', 'logScreenView', 'setUserProperties', 'getAppInstanceId',
  ]);
  assert.deepEqual(firebase.calls[3].slice(1), ['search', {query_length: 4}]);
  assert.deepEqual(firebase.calls[4][1], {screen_name: 'home', screen_class: 'home'});
});

test('web analytics never loads the SDK without consent or for automated browsers', async () => {
  const loaded = [];
  const mocks = {
    '@/core/platform/firebase/webApp': {getFirebaseMeasurementId: () => 'G-TEST', loadFirebaseApp: async () => {
      loaded.push('app');
      return {options: {}};
    }},
    'firebase/analytics': {isSupported: async () => true, setConsent: () => undefined, initializeAnalytics: () => ({app: {options: {}}}), logEvent: () => loaded.push('event')},
  };
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
  const cookies = [];
  globalThis.window = {location: {origin: 'https://yify.expo.app', pathname: '/', hostname: 'yify.expo.app'}};
  globalThis.document = {set cookie(value) {
    cookies.push(value);
  }};
  try {
    Object.defineProperty(globalThis, 'navigator', {value: {userAgent: 'HeadlessChrome', webdriver: false}, configurable: true});
    const web = loadTs('src/core/platform/telemetry/analytics.web.ts', mocks);
    web.applyAnalyticsConsent(false);
    await flush();
    assert.ok(cookies.some((cookie) => cookie.startsWith('_ga=;')));
    assert.equal(globalThis.window['ga-disable-G-TEST'], true);
    web.applyAnalyticsConsent(true);
    await flush();
    assert.deepEqual(loaded, []);
    Object.defineProperty(globalThis, 'navigator', {value: {userAgent: 'Mozilla/5.0', webdriver: false}, configurable: true});
    const human = loadTs('src/core/platform/telemetry/analytics.web.ts', mocks);
    human.applyAnalyticsConsent(true);
    await flush();
    assert.equal(human.analyticsEnabled(), true);
    assert.equal(globalThis.window['ga-disable-G-TEST'], false);
    human.logAnalyticsEvent('search', {query_length: 4});
    assert.deepEqual(loaded, ['app', 'event']);
    assert.equal(await human.analyticsInstanceId(), null);
  } finally {
    if (descriptor) Object.defineProperty(globalThis, 'navigator', descriptor);
    delete globalThis.window;
    delete globalThis.document;
  }
});
