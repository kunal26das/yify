const assert = require('node:assert/strict');
const {test} = require('node:test');
const ErrorStackParser = require('error-stack-parser');
const {loadTypeScript} = require('./helpers/load-typescript.cjs');

function fixture(t, {platform = 'android', captureFailure = false, flushFailure = false, metadataFailure = false, enabled = true} = {}) {
    const saved = new Map(['__DEV__', 'ErrorUtils', 'window'].map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
    t.after(() => {
        for (const [key, descriptor] of saved) {
            if (descriptor) Object.defineProperty(globalThis, key, descriptor);
            else delete globalThis[key];
        }
    });
    const fatal = [];
    const nonfatal = [];
    const fallback = [];
    const sent = [];
    const captured = [];
    const startup = [];
    const pending = [];
    const attributes = {};
    const client = {isCrashlyticsCollectionEnabled: enabled};
    const manager = {handleException: (error, isFatal) => fallback.push({error, isFatal})};
    const original = (error, isFatal) => manager.handleException(error, isFatal);
    let current = original;
    const errorUtils = {getGlobalHandler: () => current, setGlobalHandler: handler => { current = handler; }};
    Object.defineProperty(globalThis, '__DEV__', {value: false, configurable: true});
    Object.defineProperty(globalThis, 'ErrorUtils', {value: errorUtils, configurable: true});
    if (platform === 'web') Object.defineProperty(globalThis, 'window', {value: {}, configurable: true});
    let options;
    let sequence = 0;
    let nativeImports = 0;
    let nativeSdk;
    const integration = name => values => ({name, options: values});
    const sentry = {
        breadcrumbsIntegration: integration('Breadcrumbs'),
        reactNativeErrorHandlersIntegration: integration('ReactNativeErrorHandlers'),
        expoRouterIntegration: integration('ExpoRouter'),
        feedbackIntegration: integration('MobileFeedback'),
        init(value) { options = value; startup.push('sentry'); },
        captureException(error, hint = {}) {
            captured.push({error, hint});
            if (captureFailure) throw new Error('Sentry capture unavailable');
            const eventId = (++sequence).toString(16).padStart(32, '0');
            const frames = ErrorStackParser.parse(error).map(frame => ({
                filename: frame.fileName, function: frame.functionName,
                lineno: frame.lineNumber, colno: frame.columnNumber,
            })).reverse();
            const event = {
                event_id: eventId, platform: 'javascript', release: 'io.github.kunal26das.yify@1.8.4+84',
                environment: options.environment, level: hint.captureContext?.level ?? 'error',
                exception: {values: [{type: error.name, value: error.message,
                    mechanism: hint.mechanism ?? {type: 'generic', handled: true}, stacktrace: {frames}}]},
            };
            pending.push(Promise.resolve().then(() => options.beforeSend(event, {
                originalException: error, ...hint,
            })).then(clean => { if (clean) sent.push(clean); }));
            return eventId;
        },
        async flush() {
            await Promise.all(pending);
            if (flushFailure) throw new Error('Sentry transport unavailable');
            return true;
        },
    };
    const mocks = {
        '@expo/metro-runtime': {},
        'expo-updates': {runtimeVersion: '1.8.4', updateId: null, channel: 'Production'},
        'react-native': {Platform: {OS: platform}},
        'react-native/Libraries/Core/ExceptionsManager': {default: manager},
        '@sentry/react-native': sentry,
    };
    Object.defineProperty(mocks, '@react-native-firebase/crashlytics', {get() {
        if (nativeSdk) return nativeSdk;
        nativeImports += 1;
        startup.push('firebase');
        errorUtils.setGlobalHandler(async (error, isFatal) => fatal.push({error, isFatal, attributes: {...attributes}}));
        nativeSdk = {
            getCrashlytics: () => client,
            recordError(instance, error) { nonfatal.push({instance, error, attributes: {...attributes}}); },
            async setAttributes(instance, values) {
                assert.equal(instance, client);
                if (metadataFailure) throw new Error('Metadata unavailable');
                Object.assign(attributes, values);
            },
        };
        return nativeSdk;
    }});
    Object.defineProperty(mocks, 'expo-router/entry', {get() {
        startup.push('router');
        return {};
    }});
    if (platform === 'web') {
        const web = loadTypeScript('instrumentation/crashlytics.web.ts');
        mocks['./instrumentation/crashlytics'] = web;
        mocks['./crashlytics'] = web;
    }
    loadTypeScript('entry.ts', mocks);
    return {
        fatal, nonfatal, fallback, sent, captured, startup, sentry, options, manager,
        nativeImports: () => nativeImports,
        invokeGlobal: (error, isFatal) => current(error, isFatal),
        hasOriginalHandler: () => current === original,
    };
}

function errorAt(column = 100, message = 'Playback failed') {
    const error = new TypeError(message);
    error.stack = `TypeError: ${message}\n    at anonymous (address at index.android.bundle:1:${column})\n    at onPress (address at index.android.bundle:1:800)`;
    return error;
}

test('real entry wiring forwards a handled Sentry exception once with sanitized text and source frames', async t => {
    const f = fixture(t);
    assert.deepEqual(f.startup, ['firebase', 'sentry', 'router']);
    assert.deepEqual(f.options.integrations.find(value => value.name === 'ReactNativeErrorHandlers').options, {onerror: false});
    const error = errorAt(100, 'Failed for private@example.com token=private-token');
    const eventId = f.sentry.captureException(error);
    await f.sentry.flush();
    assert.equal(f.sent.length, 1);
    assert.equal(f.nonfatal.length, 1);
    assert.equal(f.fatal.length, 0);
    assert.equal(f.fallback.length, 0);
    assert.equal(f.nonfatal[0].error.message, 'Failed for [email] [private]');
    assert.match(f.nonfatal[0].error.stack, /YifyReactNative\.[a-p]{16}\.anonymous_TypeError.*index.android.bundle:1:100/);
    assert.equal(f.nonfatal[0].attributes.sentry_event_id, eventId);
    assert.equal(error.message, 'Failed for private@example.com token=private-token');
    assert.equal(f.nativeImports(), 1);
});

test('uncaught renderer fatal traverses Sentry beforeSend and RNFB once without a mirrored nonfatal', async t => {
    const f = fixture(t);
    const error = errorAt();
    await f.manager.handleException(error, true);
    assert.equal(f.captured.length, 1);
    assert.equal(f.sent.length, 1);
    assert.equal(f.sent[0].level, 'fatal');
    assert.deepEqual(f.sent[0].exception.values[0].mechanism, {type: 'yify.react_native.global', handled: false});
    assert.equal(f.fatal.length, 1);
    assert.equal(f.nonfatal.length, 0);
    assert.equal(f.fatal[0].isFatal, true);
    assert.match(f.fatal[0].error.stack, /YifyReactNative\.[a-p]{16}\.anonymous_TypeError.*index.android.bundle:1:100/);
    assert.deepEqual(f.fallback, [{error, isFatal: true}]);
    assert.equal(error.stack.includes('YifyReactNative'), false);
});

test('global nonfatal uses the same coordinator without duplicate beforeSend forwarding', async t => {
    const f = fixture(t);
    const error = errorAt(101);
    await f.invokeGlobal(error, false);
    assert.equal(f.sent.length, 1);
    assert.equal(f.sent[0].level, 'error');
    assert.equal(f.sent[0].exception.values[0].mechanism.handled, true);
    assert.equal(f.nonfatal.length, 1);
    assert.equal(f.fatal.length, 0);
    assert.deepEqual(f.fallback, [{error, isFatal: false}]);
});

test('unavailable Sentry capture cannot prevent the wired Firebase fatal handler', async t => {
    const f = fixture(t, {captureFailure: true});
    const error = errorAt();
    await f.invokeGlobal(error, true);
    assert.equal(f.captured.length, 1);
    assert.equal(f.sent.length, 0);
    assert.equal(f.fatal.length, 1);
    assert.equal(f.nonfatal.length, 0);
    assert.deepEqual(f.fallback, [{error, isFatal: true}]);
});

test('rejected Sentry flush still allows Firebase persistence after beforeSend', async t => {
    const f = fixture(t, {flushFailure: true});
    await f.invokeGlobal(errorAt(), true);
    assert.equal(f.sent.length, 1);
    assert.equal(f.fatal.length, 1);
    assert.equal(f.nonfatal.length, 0);
    assert.equal(f.fallback.length, 1);
});

test('Firebase metadata failure does not discard a handled exception from either reporter', async t => {
    const f = fixture(t, {metadataFailure: true});
    f.sentry.captureException(errorAt());
    await f.sentry.flush();
    assert.equal(f.sent.length, 1);
    assert.equal(f.nonfatal.length, 1);
    assert.equal(f.fatal.length, 0);
    assert.match(f.nonfatal[0].error.stack, /index.android.bundle:1:100/);
});

test('disabled Crashlytics collection preserves Sentry and React Native handling without Firebase reports', async t => {
    const f = fixture(t, {enabled: false});
    f.sentry.captureException(errorAt());
    await f.sentry.flush();
    const error = errorAt(101);
    await f.invokeGlobal(error, true);
    assert.equal(f.sent.length, 2);
    assert.equal(f.nonfatal.length, 0);
    assert.equal(f.fatal.length, 0);
    assert.deepEqual(f.fallback, [{error, isFatal: true}]);
});

test('web entry resolution retains Sentry defaults without loading or forwarding to native Crashlytics', async t => {
    const f = fixture(t, {platform: 'web'});
    assert.deepEqual(f.startup, ['sentry', 'router']);
    assert.equal(f.options.integrations.some(value => value.name === 'ReactNativeErrorHandlers'), false);
    f.sentry.captureException(errorAt());
    await f.sentry.flush();
    assert.equal(f.sent.length, 1);
    assert.equal(f.nonfatal.length, 0);
    assert.equal(f.fatal.length, 0);
    assert.equal(f.nativeImports(), 0);
    assert.equal(f.hasOriginalHandler(), true);
});
