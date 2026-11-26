const assert = require('node:assert/strict');
const {afterEach, test} = require('node:test');
const {loadTs} = require('../../../../tests/helpers/loadTs.cjs');

function browserMock() {
  const calls = {init: [], capture: [], count: []};
  const integration = (name) => (options) => ({name, options});
  return {
    calls,
    module: {
      init: (options) => calls.init.push(options),
      captureException: (...args) => calls.capture.push(args),
      addBreadcrumb: () => undefined,
      metrics: {count: (...args) => calls.count.push(args)},
      breadcrumbsIntegration: integration('Breadcrumbs'),
      globalHandlersIntegration: integration('GlobalHandlers'),
      linkedErrorsIntegration: integration('LinkedErrors'),
      dedupeIntegration: integration('Dedupe'),
      httpContextIntegration: integration('HttpContext'),
      eventFiltersIntegration: integration('EventFilters'),
    },
  };
}

function fakeWindow(hostname) {
  const listeners = new Map();
  const idle = [];
  return {
    listeners,
    idle,
    location: {hostname},
    addEventListener: (type, listener) => listeners.set(type, listener),
    removeEventListener: (type) => listeners.delete(type),
    requestIdleCallback: (callback, options) => idle.push([callback, options]),
  };
}

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

afterEach(() => {
  delete globalThis.window;
  delete globalThis.__DEV__;
});

test('web buffers early errors, loads Sentry when idle and replays the buffer', async () => {
  globalThis.__DEV__ = false;
  globalThis.window = fakeWindow('yify--v2.expo.app');
  const browser = browserMock();
  const sentry = loadTs('src/core/platform/telemetry/sentry.web.ts', {'@sentry/browser': browser.module});
  assert.ok(globalThis.window.listeners.has('error'));
  assert.ok(globalThis.window.listeners.has('unhandledrejection'));
  assert.equal(globalThis.window.idle[0][1].timeout, 3000);
  sentry.reportError(new Error('early'), {boundary: 'root'});
  globalThis.window.listeners.get('error')({error: new Error('window')});
  await flush();
  await flush();
  assert.equal(browser.calls.init.length, 1);
  const options = browser.calls.init[0];
  assert.equal(options.environment, 'preview');
  assert.equal(options.defaultIntegrations, false);
  assert.equal(options.tracesSampleRate, 0);
  assert.equal(options.enableMetrics, true);
  assert.deepEqual(options.integrations.map((item) => item.name), ['Breadcrumbs', 'GlobalHandlers', 'LinkedErrors', 'Dedupe', 'HttpContext', 'EventFilters', 'YifyTelemetryConsent']);
  assert.deepEqual(options.integrations[0].options, {console: false, dom: false});
  assert.equal(options.beforeSend({message: 'x'}, {originalException: {stack: 'at chrome-extension://abc/x.js:1:1'}}), null);
  assert.deepEqual(browser.calls.capture.map(([error, context]) => [error.message, context.tags]), [['early', {boundary: 'root'}], ['window', {}]]);
  assert.equal(globalThis.window.listeners.has('error'), false);
  sentry.reportError(new Error('late'));
  assert.equal(browser.calls.capture.length, 3);
  sentry.sentryCount('yify.operation', {operation: 'api.home'});
  assert.equal(browser.calls.count.length, 1);
  assert.equal(sentry.TELEMETRY_PLATFORM, 'web');
});

test('production is only the canonical host, and nothing loads during server rendering or development', async () => {
  globalThis.__DEV__ = false;
  globalThis.window = fakeWindow('yify.expo.app');
  const browser = browserMock();
  const sentry = loadTs('src/core/platform/telemetry/sentry.web.ts', {'@sentry/browser': browser.module});
  await sentry.loadSentry();
  assert.equal(browser.calls.init[0].environment, 'production');
  delete globalThis.window;
  const server = browserMock();
  const rendered = loadTs('src/core/platform/telemetry/sentry.web.ts', {'@sentry/browser': server.module});
  assert.equal(await rendered.loadSentry(), null);
  globalThis.__DEV__ = true;
  globalThis.window = fakeWindow('localhost');
  const dev = browserMock();
  const local = loadTs('src/core/platform/telemetry/sentry.web.ts', {'@sentry/browser': dev.module});
  assert.equal(globalThis.window.listeners.size, 0);
  local.reportError(new Error('dev'));
  await flush();
  assert.equal(dev.calls.init.length, 0);
});
