const assert = require('node:assert/strict');
const {test} = require('node:test');
const {loadTs} = require('../../../../tests/helpers/loadTs.cjs');

const RN_FIREBASE_27_2_RESERVED_EVENTS = [
  'ad_activeview', 'ad_click', 'ad_exposure', 'ad_query', 'ad_reward', 'adunit_exposure', 'app_background', 'app_clear_data',
  'app_remove', 'app_store_refund', 'app_store_subscription_cancel', 'app_store_subscription_convert', 'app_store_subscription_renew',
  'app_update', 'app_upgrade', 'dynamic_link_app_open', 'dynamic_link_app_update', 'dynamic_link_first_open', 'error', 'first_open',
  'first_visit', 'in_app_purchase', 'notification_dismiss', 'notification_foreground', 'notification_open', 'notification_receive',
  'os_update', 'session_start', 'session_start_with_rollout', 'user_engagement',
];
const RN_FIREBASE_27_2_RESERVED_PREFIXES = ['firebase_', 'google_', 'ga_'];
const GA4_WEB_RESERVED_EVENTS = [
  'ad_impression', 'app_remove', 'app_store_refund', 'app_store_subscription_cancel', 'app_store_subscription_renew', 'click', 'error',
  'file_download', 'first_open', 'first_visit', 'form_start', 'form_submit', 'in_app_purchase', 'page_view', 'scroll', 'session_start',
  'user_engagement', 'view_complete', 'video_progress', 'video_start', 'view_search_results',
];
const GA4_APP_RESERVED_EVENTS = [
  'ad_activeview', 'ad_click', 'ad_exposure', 'ad_query', 'ad_reward', 'adunit_exposure', 'app_clear_data', 'app_exception', 'app_install',
  'app_remove', 'app_store_refund', 'app_update', 'app_upgrade', 'dynamic_link_app_open', 'dynamic_link_app_update', 'dynamic_link_first_open',
  'error', 'firebase_campaign', 'firebase_in_app_message_action', 'firebase_in_app_message_dismiss', 'firebase_in_app_message_impression',
  'first_open', 'first_visit', 'notification_dismiss', 'notification_foreground', 'notification_open', 'notification_receive',
  'notification_send', 'os_update', 'session_start', 'user_engagement',
];

function analytics() {
  const calls = {events: [], screens: [], properties: []};
  return {
    calls,
    module: {
      logAnalyticsEvent: (...args) => calls.events.push(args),
      logAnalyticsScreen: (...args) => calls.screens.push(args),
      setAnalyticsUserProperties: (...args) => calls.properties.push(args),
      analyticsInstanceId: async () => 'instance',
    },
  };
}

test('track forwards the typed event, screen views go through the screen API and properties become strings', async () => {
  const {calls, module} = analytics();
  const events = loadTs('src/core/platform/telemetry/events.ts', {'./analytics': module});
  events.track({name: 'watchlist_add', params: {content_type: 'movie', content_id: events.contentId('movie', 603), surface: 'home'}});
  events.track({name: 'screen_view', params: {screen_name: 'title_movie', screen_class: 'title_movie'}});
  events.trackScreen('home');
  events.setUserProperties({plus: true, signed_in: false});
  events.setUserProperties({});
  assert.deepEqual(calls.events, [['watchlist_add', {content_type: 'movie', content_id: 'movie:603', surface: 'home'}]]);
  assert.deepEqual(calls.screens, [['title_movie'], ['home']]);
  assert.deepEqual(calls.properties, [[{plus: 'true', signed_in: 'false'}]]);
  assert.equal(await events.getAppInstanceId(), 'instance');
  assert.equal(events.ANALYTICS_EVENT_NAMES.length, 24);
  assert.equal(new Set(events.ANALYTICS_EVENT_NAMES).size, 24);
});

test('no catalog event uses a name or prefix that RNFirebase rejects or GA4 reserves', () => {
  const {ANALYTICS_EVENT_NAMES} = loadTs('src/core/platform/telemetry/events.ts', {'./analytics': analytics().module});
  const reserved = new Set([...RN_FIREBASE_27_2_RESERVED_EVENTS, ...GA4_WEB_RESERVED_EVENTS, ...GA4_APP_RESERVED_EVENTS]);
  const refused = ANALYTICS_EVENT_NAMES.filter((name) => reserved.has(name)
    || RN_FIREBASE_27_2_RESERVED_PREFIXES.some((prefix) => name.startsWith(prefix))
    || !/^[a-z][a-z0-9_]{0,39}$/.test(name));
  assert.deepEqual(refused, []);
  assert.ok(ANALYTICS_EVENT_NAMES.includes('store_update'));
});
