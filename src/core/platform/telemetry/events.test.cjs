const assert = require('node:assert/strict');
const {test} = require('node:test');
const {loadTs} = require('../../../../tests/helpers/loadTs.cjs');

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
