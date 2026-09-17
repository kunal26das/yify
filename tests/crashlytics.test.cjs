const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {test} = require('node:test');
const {loadTypeScript} = require('./helpers/load-typescript.cjs');

const {installCrashlyticsHandler: installModuleHandler} = loadTypeScript('modules/react-native-crash-reporting/index.ts');
const repoRoot = path.resolve(__dirname, '..');
const errorAt = (column, {message = 'Playback failed', caller = 800} = {}) => ({
    name: 'TypeError',
    message,
    stack: `TypeError: ${message}\n    at anonymous (address at index.android.bundle:1:${column})\n    at onPress (address at index.android.bundle:1:${caller})`,
});

test('the actual RNFB handler receives the fatal marker and individual JavaScript frames', async () => {
    const savedErrorUtils = Object.getOwnPropertyDescriptor(globalThis, 'ErrorUtils');
    const savedSilence = Object.getOwnPropertyDescriptor(globalThis, 'RNFB_SILENCE_MODULAR_DEPRECATION_WARNINGS');
    const nativeEvents = [];
    let current = (error, fatal) => nativeEvents.push({kind: 'original', error, fatal});
    const errorUtils = {
        getGlobalHandler: () => current,
        setGlobalHandler: handler => { current = handler; },
    };
    Object.defineProperty(globalThis, 'ErrorUtils', {value: errorUtils, configurable: true});
    try {
        const sdk = loadTypeScript('node_modules/@react-native-firebase/crashlytics/lib/handlers.ts', {
            '.': {firebase: {app: () => ({analytics: () => ({
                logEvent: async (name, params) => nativeEvents.push({kind: 'analytics', name, params}),
            })})}},
            '@react-native-firebase/app/dist/module/common': {
                isError: value => value instanceof Error,
                once: fn => fn,
            },
            'promise/setimmediate/rejection-tracking': {enable() {}},
        });
        const native = {
            isCrashlyticsCollectionEnabled: true,
            isErrorGenerationOnJSCrashEnabled: true,
            isCrashlyticsJavascriptExceptionHandlerChainingEnabled: false,
            logPromise: async message => nativeEvents.push({kind: 'log', message}),
            setAttribute: async (name, value) => nativeEvents.push({kind: 'attribute', name, value}),
            recordErrorPromise: async error => nativeEvents.push({kind: 'nonfatal', error}),
            crashWithStackPromise: async error => nativeEvents.push({kind: 'crash', error}),
        };
        installModuleHandler(errorUtils, () => {
            sdk.setGlobalErrorHandler(native);
            return native;
        }, (client, error) => nativeEvents.push({kind: 'public-nonfatal', client, error}));
        const original = errorAt(100);
        await current(original, true);
        const fatalFlag = nativeEvents.find(event => event.kind === 'attribute');
        assert.equal(fatalFlag.name, 'com.firebase.crashlytics.reactnative.fatal');
        assert.match(fatalFlag.value, /^\d+$/);
        assert.equal(nativeEvents.find(event => event.kind === 'analytics').params.fatal, 1);
        assert.equal(nativeEvents.filter(event => event.kind === 'crash').length, 1);
        assert.equal(nativeEvents.filter(event => event.kind === 'nonfatal').length, 0);
        const payload = nativeEvents.find(event => event.kind === 'crash').error;
        assert.equal(payload.message, original.message);
        assert.equal(payload.isUnhandledRejection, false);
        assert.equal(payload.frames.length, 2);
        assert.match(payload.frames[0].fn, /^ReactNativeCrash\.[a-p]{16}\.anonymous_TypeError$/);
        assert.equal(payload.frames[0].file, 'index.android.bundle:1:100');
        assert.equal(payload.frames[0].line, 1);
        assert.equal(payload.frames[0].col, 100);
        assert.equal(payload.frames[1].fn, 'onPress');
        assert.equal(payload.frames[1].file, 'index.android.bundle:1:800');
        assert.equal(payload.frames.some(frame => frame.file.includes('react-native-crash')), false);
        assert.equal(nativeEvents.at(-1).kind, 'original');
        assert.equal(nativeEvents.at(-1).error, original);

        for (const error of [errorAt(101), errorAt(100, {message: 'Another title failed'})]) {
            await current(error, true);
        }
        const crashes = nativeEvents.filter(event => event.kind === 'crash').map(event => event.error);
        assert.equal(crashes.length, 3);
        assert.notEqual(crashes[0].frames[0].fn, crashes[1].frames[0].fn);
        assert.equal(crashes[0].frames[0].fn, crashes[2].frames[0].fn);
        assert.deepEqual(crashes.map(crash => crash.frames[0].file), [
            'index.android.bundle:1:100', 'index.android.bundle:1:101', 'index.android.bundle:1:100',
        ]);
        assert.ok(crashes.every(crash => crash.frames.length === 2));

        nativeEvents.length = 0;
        await current(errorAt(101), false);
        assert.deepEqual(nativeEvents.map(event => event.kind), ['public-nonfatal', 'original']);
    } finally {
        if (savedErrorUtils) Object.defineProperty(globalThis, 'ErrorUtils', savedErrorUtils);
        else delete globalThis.ErrorUtils;
        if (savedSilence) Object.defineProperty(globalThis, 'RNFB_SILENCE_MODULAR_DEPRECATION_WARNINGS', savedSilence);
        else delete globalThis.RNFB_SILENCE_MODULAR_DEPRECATION_WARNINGS;
    }
});

test('startup installs Firebase crash interception before Sentry and application modules', () => {
    const entry = fs.readFileSync(path.join(repoRoot, 'entry.ts'), 'utf8');
    const firebase = entry.indexOf("'./instrumentation/crashlytics'");
    const sentry = entry.indexOf("'./instrumentation/sentry'");
    const router = entry.indexOf("'expo-router/entry'");
    assert.ok(firebase >= 0, 'Firebase interception must be loaded by the custom entry');
    assert.ok(firebase < sentry, 'Sentry must capture the Firebase guard as its previous handler');
    assert.ok(sentry < router, 'both reporters must initialize before application modules');
});

test('bootstrap captures React Native before importing the SDK that eagerly installs its fatal handler', async () => {
    const savedDev = Object.getOwnPropertyDescriptor(globalThis, '__DEV__');
    const savedErrorUtils = Object.getOwnPropertyDescriptor(globalThis, 'ErrorUtils');
    const events = [];
    const original = (error, fatal) => events.push({kind: 'original', error, fatal});
    let current = original;
    const errorUtils = {
        getGlobalHandler: () => current,
        setGlobalHandler: handler => { current = handler; },
    };
    const client = {isCrashlyticsCollectionEnabled: true};
    let imports = 0;
    let loadedSdk;
    const mocks = {
        'expo-updates': {runtimeVersion: '1.7.7', updateId: null, channel: 'Production'},
        'react-native/Libraries/Core/ExceptionsManager': {default: {handleException() {}}},
    };
    Object.defineProperty(mocks, '@react-native-firebase/crashlytics', {
        get() {
            if (loadedSdk) return loadedSdk;
            imports += 1;
            errorUtils.setGlobalHandler(async (error, fatal) => {
                events.push({kind: 'sdk-fatal', error, fatal});
            });
            loadedSdk = {
                getCrashlytics: () => client,
                recordError: (instance, error) => events.push({kind: 'nonfatal', instance, error}),
                setAttributes: async () => {},
            };
            return loadedSdk;
        },
    });
    Object.defineProperty(globalThis, '__DEV__', {value: false, configurable: true});
    Object.defineProperty(globalThis, 'ErrorUtils', {value: errorUtils, configurable: true});
    try {
        loadTypeScript('instrumentation/crashlytics.ts', mocks);
        assert.equal(imports, 1);
        const fatal = errorAt(100);
        await current(fatal, true);
        assert.deepEqual(events.map(event => event.kind), ['sdk-fatal', 'original']);
        assert.notEqual(events[0].error, fatal);
        assert.match(events[0].error.stack, /YifyReactNative\.[a-p]{16}\.anonymous_TypeError/);
        assert.equal(events[0].fatal, true);
        assert.equal(events[1].error, fatal);
        assert.equal(events[1].fatal, true);
        assert.equal(fatal.stack.includes('YifyReactNative.'), false);

        events.length = 0;
        const nonfatal = errorAt(101);
        await current(nonfatal, false);
        assert.deepEqual(events.map(event => event.kind), ['nonfatal', 'original']);
        assert.equal(events[0].instance, client);
        assert.match(events[0].error.stack, /YifyReactNative\.[a-p]{16}\.anonymous_TypeError/);
        assert.equal(events[1].error, nonfatal);
        assert.equal(events[1].fatal, false);
        assert.equal(imports, 1, 'the SDK should remain loaded after startup');
    } finally {
        if (savedDev) Object.defineProperty(globalThis, '__DEV__', savedDev);
        else delete globalThis.__DEV__;
        if (savedErrorUtils) Object.defineProperty(globalThis, 'ErrorUtils', savedErrorUtils);
        else delete globalThis.ErrorUtils;
    }
});

test('development and web entry points do not initialize Firebase crash reporting', () => {
    const savedDev = Object.getOwnPropertyDescriptor(globalThis, '__DEV__');
    const savedErrorUtils = Object.getOwnPropertyDescriptor(globalThis, 'ErrorUtils');
    let calls = 0;
    const unexpected = () => { calls += 1; throw new Error('Firebase must not initialize'); };
    const mocks = {
        get '@react-native-firebase/crashlytics'() { return unexpected(); },
        get 'react-native/Libraries/Core/ExceptionsManager'() { return unexpected(); },
        'expo-updates': {},
    };
    Object.defineProperty(globalThis, 'ErrorUtils', {
        value: {getGlobalHandler: unexpected, setGlobalHandler: unexpected}, configurable: true,
    });
    try {
        Object.defineProperty(globalThis, '__DEV__', {value: true, configurable: true});
        assert.doesNotThrow(() => loadTypeScript('instrumentation/crashlytics.ts', mocks));
        for (const dev of [false, true]) {
            Object.defineProperty(globalThis, '__DEV__', {value: dev, configurable: true});
            assert.doesNotThrow(() => loadTypeScript('instrumentation/crashlytics.web.ts', mocks));
        }
        assert.equal(calls, 0);
    } finally {
        if (savedDev) Object.defineProperty(globalThis, '__DEV__', savedDev);
        else delete globalThis.__DEV__;
        if (savedErrorUtils) Object.defineProperty(globalThis, 'ErrorUtils', savedErrorUtils);
        else delete globalThis.ErrorUtils;
    }
});
