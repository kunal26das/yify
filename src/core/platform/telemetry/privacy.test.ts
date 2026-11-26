import assert from 'node:assert/strict';
import {test} from 'node:test';
import {
  createEventCap,
  isBrowserExtensionError,
  sanitizeBreadcrumb,
  sanitizeDiagnosticAttributes,
  sanitizeErrorEvent,
  sanitizeMetric,
  sanitizeRoute,
  webEnvironment,
} from './privacy';

test('routes collapse to their patterns and unknown paths are dropped', () => {
  assert.equal(sanitizeRoute('/'), '/');
  assert.equal(sanitizeRoute('(tabs)/(home)/index'), '/');
  assert.equal(sanitizeRoute('/title/movie/603-the-matrix?ref=share'), '/title/movie/[id]');
  assert.equal(sanitizeRoute('(tabs)/(home,search,library,you)/title/tv/[id]/index'), '/title/tv/[id]');
  assert.equal(sanitizeRoute('/title/tv/1399-game-of-thrones/season/1'), '/title/tv/[id]/season/[season]');
  assert.equal(sanitizeRoute('/person/6384-keanu-reeves'), '/person/[id]');
  assert.equal(sanitizeRoute('/settings/privacy'), '/settings/privacy');
  assert.equal(sanitizeRoute('/library/watched?view=insights'), '/library/watched');
  assert.equal(sanitizeRoute('/list/l_abc'), '/list/[id]');
  assert.equal(sanitizeRoute('/search?q=secret'), '/search');
  assert.equal(sanitizeRoute('/somewhere/else'), undefined);
  assert.equal(sanitizeRoute(42), undefined);
});

test('error events lose users, request details, extras and free text secrets', () => {
  const event = sanitizeErrorEvent({
    type: undefined,
    user: {id: 'uid-123', email: 'a@b.co'},
    extra: {token: 'x'},
    server_name: 'host',
    request: {url: 'https://yify.expo.app/search?q=dune', method: 'GET', headers: {cookie: 'x'}},
    message: 'failed for kunal@example.com with Bearer abc.def token=xyz at https://yify.expo.app/search?q=dune',
    tags: {operation: 'api.search', email: 'a@b.co', 'route.name': '/person/6384-keanu-reeves'},
    exception: {values: [{type: 'Error', value: 'uid=abc', mechanism: {type: 'onerror', handled: false, data: {x: 1}}, stacktrace: {frames: [{filename: 'app.js', vars: {secret: 1}}]}}]},
    contexts: {device: {model: 'Pixel', name: 'Kunal phone', battery_level: 50}, geo: {city: 'x'}},
  });
  assert.equal(event.user, undefined);
  assert.equal(event.extra, undefined);
  assert.equal(event.server_name, undefined);
  assert.deepEqual(event.request, {url: 'https://yify.expo.app', method: 'GET'});
  assert.equal(event.message, 'failed for [email] with [credential] [private] at https://yify.expo.app');
  assert.deepEqual(event.tags, {operation: 'api.search', 'route.name': '/person/[id]'});
  assert.equal(event.exception?.values?.[0].value, '[private]');
  assert.equal(event.exception?.values?.[0].mechanism?.data, undefined);
  assert.equal(event.exception?.values?.[0].stacktrace?.frames?.[0].vars, undefined);
  assert.deepEqual(event.contexts, {device: {model: 'Pixel', battery_level: 50}});
});

test('breadcrumbs keep origins and route patterns only, and console crumbs are dropped', () => {
  assert.equal(sanitizeBreadcrumb({category: 'console', message: 'hello'}), null);
  assert.deepEqual(sanitizeBreadcrumb({type: 'http', category: 'fetch', message: 'GET', data: {url: 'https://yify.expo.app/api/v2/search?q=dune', method: 'GET', status_code: 200}}),
    {type: 'http', category: 'fetch', message: undefined, data: {url: 'https://yify.expo.app', method: 'GET', status_code: 200}});
  assert.deepEqual(sanitizeBreadcrumb({category: 'navigation', data: {from: '/search?q=x', to: '/title/movie/603-the-matrix'}}),
    {category: 'navigation', message: undefined, data: {from: '/search', to: '/title/movie/[id]'}});
  assert.equal(sanitizeBreadcrumb({category: 'operation', message: 'api.home ok'})?.message, 'api.home ok');
  assert.equal(sanitizeBreadcrumb({category: 'operation', message: 'The Matrix ok'})?.message, undefined);
  assert.equal(sanitizeBreadcrumb({category: 'ui.click', message: 'Clicked The Matrix'})?.message, undefined);
});

test('only the operation metric with known attributes survives', () => {
  assert.equal(sanitizeMetric({name: 'other', value: 1, type: 'counter'}), null);
  assert.equal(sanitizeMetric({name: 'yify.operation', value: -1, type: 'counter'}), null);
  assert.deepEqual(sanitizeMetric({name: 'yify.operation', value: 1, type: 'counter', unit: 'x', attributes: {
    operation: 'api.home', outcome: 'http_5xx', platform: 'android', ms: 120, sdk_code: 'PURCHASE_CANCELLED', title: 'The Matrix', reason: 'with space',
  }}), {name: 'yify.operation', value: 1, type: 'counter', unit: undefined, attributes: {
    operation: 'api.home', outcome: 'http_5xx', platform: 'android', ms: 120, sdk_code: 'PURCHASE_CANCELLED',
  }});
  assert.deepEqual(sanitizeDiagnosticAttributes({operation: 'not an op', count: 2}), {count: 2});
});

test('extension errors, the event cap and the web environment', () => {
  assert.equal(isBrowserExtensionError({stack: 'Error\n at chrome-extension://abc/x.js:1:1'}), true);
  assert.equal(isBrowserExtensionError({stack: 'Error\n at https://yify.expo.app/_expo/x.js:1:1\n at chrome-extension://abc/x.js:1:1'}), false);
  assert.equal(isBrowserExtensionError('nope'), false);
  const allow = createEventCap(2);
  assert.deepEqual([allow(), allow(), allow()], [true, true, false]);
  assert.equal(webEnvironment('yify.expo.app'), 'production');
  assert.equal(webEnvironment('YIFY.EXPO.APP'), 'production');
  assert.equal(webEnvironment('yify--v2.expo.app'), 'preview');
  assert.equal(webEnvironment('localhost'), 'preview');
  assert.equal(webEnvironment(undefined), 'preview');
});
