const assert = require('node:assert/strict');
const {afterEach, test} = require('node:test');
const {loadTs} = require('../../../../tests/helpers/loadTs.cjs');

function sentryMock() {
  const calls = {init: [], capture: [], count: [], breadcrumb: [], crash: 0};
  const integration = (name) => (options) => ({name, options});
  return {
    calls,
    module: {
      init: (options) => calls.init.push(options),
      captureException: (...args) => calls.capture.push(args),
      addBreadcrumb: (crumb) => calls.breadcrumb.push(crumb),
      metrics: {count: (...args) => calls.count.push(args)},
      nativeCrash: () => {
        calls.crash += 1;
      },
      breadcrumbsIntegration: integration('Breadcrumbs'),
      feedbackIntegration: integration('MobileFeedback'),
    },
  };
}

afterEach(() => {
  delete globalThis.__DEV__;
});

function load(dev) {
  globalThis.__DEV__ = dev;
  const sentry = sentryMock();
  const consent = loadTs('src/core/platform/telemetry/consent.ts');
  const module = loadTs('src/core/platform/telemetry/sentry.ts', {'@sentry/react-native': sentry.module, './consent': consent});
  return {sentry, module, consent};
}

test('release builds initialise Sentry at import with the privacy options of C5.2', () => {
  const {sentry} = load(false);
  assert.equal(sentry.calls.init.length, 1);
  const options = sentry.calls.init[0];
  assert.match(options.dsn, /^https:\/\/[0-9a-f]+@o\d+\.ingest\.us\.sentry\.io\/\d+$/);
  assert.equal(options.environment, undefined);
  assert.equal(options.sendDefaultPii, false);
  assert.equal(options.sampleRate, 1);
  assert.equal(options.maxBreadcrumbs, 50);
  assert.equal(options.enableLogs, false);
  assert.equal(options.enableAutoSessionTracking, false);
  assert.equal(options.enableAppStartTracking, true);
  assert.equal(options.enableNativeFramesTracking, true);
  assert.equal(options.enableStallTracking, true);
  assert.deepEqual(options.tracePropagationTargets, []);
  assert.equal(options.integrations.some((item) => item.name === 'ReactNativeErrorHandlers'), false);
  assert.deepEqual(options.integrations.find((item) => item.name === 'Breadcrumbs').options, {console: false});
  assert.equal(options.integrations.find((item) => item.name === 'MobileFeedback').options.formTitle, 'Report a problem');
});

test('traces and metrics follow analytics consent and error events stop after 25', () => {
  const {sentry, consent} = load(false);
  const options = sentry.calls.init[0];
  assert.equal(options.tracesSampler(), 0);
  assert.equal(options.beforeSendMetric({name: 'yify.operation', value: 1, type: 'counter', attributes: {operation: 'api.home'}}), null);
  consent.applyTelemetryConsent(true);
  assert.equal(options.tracesSampler(), 0.1);
  const metric = options.beforeSendMetric({name: 'yify.operation', value: 1, type: 'counter', attributes: {operation: 'api.home', title: 'x'}});
  assert.equal(metric.attributes.operation, 'api.home');
  assert.equal(metric.attributes.title, undefined);
  assert.equal(options.beforeSendTransaction({contexts: {trace: {data: {}}}}), null);
  let kept = 0;
  for (let index = 0; index < 30; index += 1) if (options.beforeSend({message: 'x'}, {}) !== null) kept += 1;
  assert.equal(kept, 25);
});

test('development builds skip init, and the facade reports through the SDK', () => {
  const {sentry, module} = load(true);
  assert.equal(sentry.calls.init.length, 0);
  module.reportError(new Error('boom'), {boundary: 'root', tags: {screen: 'home'}});
  assert.deepEqual(sentry.calls.capture[0][1], {tags: {screen: 'home', boundary: 'root'}});
  module.sentryCount('yify.operation', {operation: 'api.home'});
  assert.deepEqual(sentry.calls.count[0], ['yify.operation', 1, {attributes: {operation: 'api.home'}}]);
  module.sentryBreadcrumb('operation', 'api.home ok');
  assert.deepEqual(sentry.calls.breadcrumb[0], {category: 'operation', message: 'api.home ok', level: 'info'});
  module.crashNative();
  assert.equal(sentry.calls.crash, 1);
  assert.equal(module.TELEMETRY_PLATFORM, 'android');
});
