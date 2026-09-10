const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {test} = require('node:test');
const StackTrace = require('stacktrace-js');
const {loadTypeScript} = require('./helpers/load-typescript.cjs');

const {createCrashlyticsError} = loadTypeScript('instrumentation/crashlytics-error.ts');
const {installCrashlyticsHandler} = loadTypeScript('instrumentation/crashlytics-handler.ts');

const repoRoot = path.resolve(__dirname, '..');
const framesOf = error => StackTrace.fromError(error, {offline: true});
const errorAt = (column, {message = 'Playback failed', caller = 800} = {}) => ({
    name: 'TypeError',
    message,
    stack: `TypeError: ${message}\n    at anonymous (address at index.android.bundle:1:${column})\n    at onPress (address at index.android.bundle:1:${caller})`,
});

async function signatureOf(error) {
    const frames = await framesOf(createCrashlyticsError(error));
    const identified = frames.filter(frame => frame.functionName?.includes('YifyReactNative.'));
    assert.equal(identified.length, 1, 'exactly one crash frame should carry the grouping identity');
    const signature = identified[0].functionName.match(/^YifyReactNative\.[a-p]{16}\..+_[A-Za-z0-9_$]+$/);
    assert.ok(signature, 'the identity must end in a stable 64-bit fingerprint');
    return signature[0];
}

function handlerHarness({enabled = true, sdkHandler, recordNonFatal} = {}) {
    const events = [];
    const original = (error, fatal) => events.push({kind: 'original', error, fatal});
    let current = original;
    const errorUtils = {
        getGlobalHandler: () => current,
        setGlobalHandler: handler => { current = handler; },
    };
    const client = {isCrashlyticsCollectionEnabled: enabled};
    const createCrashlytics = () => {
        events.push({kind: 'initialize'});
        errorUtils.setGlobalHandler(sdkHandler || (async (error, fatal) => {
            events.push({kind: 'sdk', error, fatal});
        }));
        return client;
    };
    installCrashlyticsHandler(errorUtils, createCrashlytics, recordNonFatal || ((instance, error) => {
        events.push({kind: 'nonfatal', client: instance, error});
    }));
    return {client, events, errorUtils, original, invoke: (...args) => current(...args)};
}

test('different anonymous Hermes crash locations stay distinct and repeated crashes retain one identity', async () => {
    const firstA = await signatureOf(errorAt(100));
    const firstB = await signatureOf(errorAt(101));
    const nextA = await signatureOf(errorAt(100));
    assert.notEqual(firstA, firstB);
    assert.equal(firstA, nextA);
});

test('a crash identity follows its source location without splitting on dynamic messages or caller frames', async () => {
    assert.equal(
        await signatureOf(errorAt(100, {message: 'Missing movie 123', caller: 800})),
        await signatureOf(errorAt(100, {message: 'Missing movie 456', caller: 900})),
    );
    assert.notEqual(
        await signatureOf(errorAt(100)),
        await signatureOf({...errorAt(100), name: 'RangeError'}),
    );
});

test('equivalent JSC and V8 crash frames ignore installation paths and bundle URL parameters', async () => {
    const jsc = {
        name: 'Error', message: 'Load failed',
        stack: 'loadMovie@file:///private/app/installation-A/main.jsbundle?build=one:12:34\nrender@file:///private/app/installation-A/main.jsbundle:50:6',
    };
    const v8 = {
        name: 'Error', message: 'Load failed again',
        stack: 'Error: Load failed again\n    at loadMovie (https://cdn.example/installation-B/main.jsbundle?build=two:12:34)\n    at render (https://cdn.example/installation-B/main.jsbundle:60:7)',
    };
    assert.equal(await signatureOf(jsc), await signatureOf(v8));
});

test('same-named source files in different directories keep distinct crash identities', async () => {
    const fromFile = file => ({
        name: 'TypeError', message: 'Unable to render title',
        stack: `TypeError: Unable to render title\n    at render (${file}:30:4)\n    at RootLayout (app/_layout.tsx:20:6)`,
    });
    const movieCrash = fromFile('presentation/movies/Details.tsx');
    const showCrash = fromFile('presentation/shows/Details.tsx');
    assert.notEqual(await signatureOf(movieCrash), await signatureOf(showCrash));
    assert.equal(await signatureOf(movieCrash), await signatureOf(fromFile('presentation/movies/Details.tsx')));
});

test('the Firebase copy annotates the real failing frame without adding synthetic frames or losing source positions', async () => {
    const input = errorAt(100);
    const result = createCrashlyticsError(input);
    const frames = await framesOf(result);
    assert.ok(result instanceof Error);
    assert.equal(result.message, input.message);
    assert.equal(frames.length, 2);
    assert.match(frames[0].functionName, /^YifyReactNative\.[a-p]{16}\.anonymous_TypeError$/);
    assert.equal(frames[1].functionName, 'onPress');
    assert.deepEqual(frames.map(frame => ({
        file: frame.fileName,
        line: frame.lineNumber,
        column: frame.columnNumber,
    })), [
        {file: 'index.android.bundle', line: 1, column: 100},
        {file: 'index.android.bundle', line: 1, column: 800},
    ]);
    assert.equal(result.stack.includes('react-native-crash'), false, 'a disposable helper frame must not carry grouping');
});

test('native frames remain in the report while grouping follows the first usable JavaScript source', async () => {
    for (const [stackAt, nativeFile] of [
        [column => `TypeError: Playback failed\n    at nativeCall (native)\n    at play (index.android.bundle:1:${column})`, 'native'],
        [column => `nativeCall@[native code]\nplay@index.android.bundle:1:${column}`, '[native code]'],
    ]) {
        const input = {name: 'TypeError', message: 'Playback failed', stack: stackAt(100)};
        const frames = await framesOf(createCrashlyticsError(input));
        assert.equal(frames.length, 2);
        assert.equal(frames[0].functionName, 'nativeCall');
        assert.equal(frames[0].fileName, nativeFile);
        assert.match(frames[1].functionName, /^YifyReactNative\.[a-p]{16}\.play_TypeError$/);
        assert.equal(frames[1].fileName, 'index.android.bundle');
        assert.equal(frames[1].lineNumber, 1);
        assert.equal(frames[1].columnNumber, 100);
        assert.equal(await signatureOf(input), await signatureOf({
            name: 'TypeError', message: 'Another dynamic message',
            stack: 'TypeError: Another dynamic message\n    at play (index.android.bundle:1:100)',
        }));
        assert.notEqual(await signatureOf(input), await signatureOf({...input, stack: stackAt(101)}));
    }
});

test('normalization leaves the original error and React component stack available to other reporters', () => {
    const original = Object.assign(new TypeError('Cannot render this title'), errorAt(100), {
        componentStack: '\n    at MovieDetails (MovieDetails.tsx:30:1)\n    at RootLayout',
    });
    const before = Object.getOwnPropertyDescriptors(original);
    const copy = createCrashlyticsError(original);
    assert.notEqual(copy, original);
    assert.equal(copy.componentStack, original.componentStack);
    assert.deepEqual(Object.getOwnPropertyDescriptors(original), before);
});

test('an error with no useful JS source falls back to its React component stack', async () => {
    const componentStack = '\n    at MovieDetails (MovieDetails.tsx:30:4)\n    at RootLayout (RootLayout.tsx:12:8)';
    const first = {name: 'Error', message: 'Render failed for 123', componentStack};
    const second = {name: 'Error', message: 'Render failed for 456', stack: 'unknown', componentStack};
    assert.equal(await signatureOf(first), await signatureOf(second));
    const frames = await framesOf(createCrashlyticsError(first));
    assert.equal(frames.length, 2);
    assert.match(frames[0].functionName, /^YifyReactNative\.[a-p]{16}\.MovieDetails_Error$/);
    assert.equal(frames[0].fileName, 'MovieDetails.tsx');
    assert.equal(frames[0].lineNumber, 30);
    assert.equal(frames[0].columnNumber, 4);
    assert.equal(frames[1].functionName, 'RootLayout');
    assert.notEqual(await signatureOf(first), await signatureOf({
        ...first, componentStack: componentStack.replace('30:4', '31:4'),
    }));
});

test('thrown strings and error-like objects without usable source retain a stable message-based identity', async () => {
    for (const input of [
        'Playback failed',
        {name: 'Error', message: 'Playback failed'},
        {name: 'Error', message: 'Playback failed', stack: 'not a JavaScript stack'},
    ]) {
        const error = createCrashlyticsError(input);
        assert.ok(error instanceof Error);
        assert.equal(error.message, 'Playback failed');
        assert.equal((await framesOf(error)).length, 1, 'reporter implementation frames must not become crash frames');
    }
    assert.equal(await signatureOf('Playback failed'), await signatureOf('Playback failed'));
    assert.notEqual(await signatureOf('Playback failed'), await signatureOf('Account update failed'));
    assert.notEqual(
        await signatureOf({name: 'Error', message: 'Playback failed'}),
        await signatureOf({name: 'TypeError', message: 'Playback failed'}),
    );
});

test('normalization survives unusual thrown values and hostile error property getters', () => {
    const hostile = Object.create(null);
    for (const key of ['name', 'message', 'stack', 'componentStack']) {
        Object.defineProperty(hostile, key, {get: () => { throw new Error(`unreadable ${key}`); }});
    }
    for (const input of [undefined, null, 7, false, Symbol('failed'), hostile]) {
        assert.doesNotThrow(() => {
            const normalized = createCrashlyticsError(input);
            assert.ok(normalized instanceof Error);
            assert.equal(typeof normalized.message, 'string');
            assert.match(normalized.stack, /YifyReactNative\./);
        });
    }
});

test('fatal interception sends the normalized crash to RNFB and preserves the original for its fallback', async () => {
    const harness = handlerHarness();
    const error = errorAt(100);
    await harness.invoke(error, true);
    assert.deepEqual(harness.events.map(event => event.kind), ['initialize', 'sdk', 'original']);
    const sdk = harness.events[1];
    assert.equal(sdk.fatal, true);
    assert.notEqual(sdk.error, error);
    assert.equal(sdk.error.message, error.message);
    assert.match(sdk.error.stack, /YifyReactNative\./);
    assert.equal(harness.events[2].error, error);
    assert.equal(harness.events[2].fatal, true);
});

test('RNFB gets time to persist the fatal crash before the original fatal handler is invoked', async () => {
    let complete;
    const persisted = new Promise(resolve => { complete = resolve; });
    const harness = handlerHarness({sdkHandler: async () => persisted});
    const pending = harness.invoke(errorAt(100), true);
    assert.equal(harness.events.some(event => event.kind === 'original'), false);
    complete();
    await pending;
    assert.equal(harness.events.filter(event => event.kind === 'original').length, 1);
});

test('a failing fatal reporter still reaches React Native with the original crash', async () => {
    for (const sdkHandler of [
        () => { throw new Error('Native reporter unavailable'); },
        async () => { throw new Error('Native reporter unavailable'); },
    ]) {
        const harness = handlerHarness({sdkHandler});
        const error = errorAt(100);
        await assert.doesNotReject(async () => harness.invoke(error, true));
        const forwarded = harness.events.filter(event => event.kind === 'original');
        assert.equal(forwarded.length, 1);
        assert.equal(forwarded[0].error, error);
        assert.equal(forwarded[0].fatal, true);
    }
});

test('nonfatal and unspecified errors use recordError without the terminal RNFB handler', async () => {
    for (const fatal of [false, undefined]) {
        const harness = handlerHarness();
        const error = errorAt(100);
        await harness.invoke(error, fatal);
        assert.deepEqual(harness.events.map(event => event.kind), ['initialize', 'nonfatal', 'original']);
        assert.equal(harness.events[1].client, harness.client);
        assert.equal(harness.events[1].error.message, error.message);
        assert.equal(harness.events[2].error, error);
        assert.equal(harness.events[2].fatal, fatal);
    }
});

test('nonfatal reporting failures cannot suppress React Native error handling', async () => {
    const harness = handlerHarness({recordNonFatal: () => { throw new Error('Record unavailable'); }});
    const error = errorAt(100);
    await harness.invoke(error, false);
    assert.equal(harness.events.filter(event => event.kind === 'sdk').length, 0);
    const forwarded = harness.events.filter(event => event.kind === 'original');
    assert.equal(forwarded.length, 1);
    assert.equal(forwarded[0].error, error);
    assert.equal(forwarded[0].fatal, false);
});

test('disabled collection preserves the existing handler without recording or manufacturing a fatal error', async () => {
    for (const fatal of [true, false, undefined]) {
        const harness = handlerHarness({enabled: false});
        const error = errorAt(100);
        await harness.invoke(error, fatal);
        assert.deepEqual(harness.events.map(event => event.kind), ['initialize', 'original']);
        assert.equal(harness.events[1].error, error);
        assert.equal(harness.events[1].fatal, fatal);
    }
});

test('the collection preference is read when a crash occurs, including changes after startup', async () => {
    const harness = handlerHarness();
    harness.client.isCrashlyticsCollectionEnabled = false;
    await harness.invoke(errorAt(100), true);
    assert.deepEqual(harness.events.map(event => event.kind), ['initialize', 'original']);
    harness.events.length = 0;
    harness.client.isCrashlyticsCollectionEnabled = true;
    await harness.invoke(errorAt(100), true);
    assert.deepEqual(harness.events.map(event => event.kind), ['sdk', 'original']);
});

test('failed Firebase initialization restores the original handler even after a partial SDK install', async () => {
    const calls = [];
    const original = (error, fatal) => calls.push({error, fatal});
    let current = original;
    const errorUtils = {
        getGlobalHandler: () => current,
        setGlobalHandler: handler => { current = handler; },
    };
    assert.doesNotThrow(() => installCrashlyticsHandler(errorUtils, () => {
        current = () => { throw new Error('Partially initialized SDK'); };
        throw new Error('No Firebase app');
    }, () => { throw new Error('Must never record'); }));
    assert.equal(current, original);
    const error = errorAt(100);
    await current(error, true);
    assert.deepEqual(calls, [{error, fatal: true}]);
});

test('a reentrant fatal report cannot recursively invoke the terminal RNFB handler', async () => {
    let sdkCalls = 0;
    let harness;
    harness = handlerHarness({sdkHandler: async () => {
        sdkCalls += 1;
        assert.equal(sdkCalls, 1, 'fatal reporting reentered itself');
        await harness.invoke(new Error('Reporter itself failed'), true);
    }});
    await harness.invoke(errorAt(100), true);
    assert.equal(sdkCalls, 1);
});

test('Sentry can wrap the guard and observe the untouched crash before Firebase normalization', async () => {
    const harness = handlerHarness();
    const firebaseHandler = harness.errorUtils.getGlobalHandler();
    const sentryEvents = [];
    harness.errorUtils.setGlobalHandler((error, fatal) => {
        sentryEvents.push({error, fatal});
        return firebaseHandler(error, fatal);
    });
    const error = errorAt(100);
    await harness.invoke(error, true);
    assert.equal(sentryEvents.length, 1);
    assert.equal(sentryEvents[0].error, error);
    assert.equal(sentryEvents[0].fatal, true);
    assert.equal(error.stack.includes('YifyReactNative.'), false);
    assert.notEqual(harness.events.find(event => event.kind === 'sdk').error, error);
});

function rendererHarness({enabled = true, reporterThrows = false} = {}) {
    const events = [];
    const manager = {
        handleException: (error, fatal) => events.push({kind: 'native', error, fatal}),
    };
    let current = (error, fatal) => manager.handleException(error, fatal);
    const errorUtils = {
        getGlobalHandler: () => current,
        setGlobalHandler: handler => { current = handler; },
    };
    installCrashlyticsHandler(errorUtils, () => {
        current = async (error, fatal) => {
            events.push({kind: 'firebase', error, fatal});
            if (reporterThrows) throw new Error('Reporter unavailable');
        };
        return {isCrashlyticsCollectionEnabled: enabled};
    }, () => events.push({kind: 'nonfatal'}), manager);
    const firebase = current;
    current = async (error, fatal) => {
        events.push({kind: 'sentry', error, fatal});
        await Promise.resolve();
        return firebase(error, fatal);
    };
    return {events, manager, globalFatal: error => current(error, true)};
}

test('uncaught render errors reach both reporters with the original Sentry error and no fallback recursion', async () => {
    const harness = rendererHarness();
    const error = errorAt(100);
    await harness.manager.handleException(error, true);
    assert.deepEqual(harness.events.map(event => event.kind), ['sentry', 'firebase', 'native']);
    assert.equal(harness.events[0].error, error);
    assert.notEqual(harness.events[1].error, error);
    assert.equal(harness.events[2].error, error);
    assert.ok(harness.events.every(event => event.fatal === true));
});

test('global fatal fallback bypasses the renderer hook even when Firebase is disabled or fails', async () => {
    for (const options of [{}, {enabled: false}, {reporterThrows: true}]) {
        for (const origin of ['renderer', 'global']) {
            const harness = rendererHarness(options);
            const error = errorAt(100);
            if (origin === 'renderer') await harness.manager.handleException(error, true);
            else await harness.globalFatal(error);
            assert.deepEqual(harness.events.map(event => event.kind), options.enabled === false
                ? ['sentry', 'native'] : ['sentry', 'firebase', 'native']);
            assert.equal(harness.events.at(-1).error, error);
        }
    }
});

test('caught render errors stay on React Native’s nonfatal path', () => {
    const harness = rendererHarness();
    const error = errorAt(100);
    harness.manager.handleException(error, false);
    assert.deepEqual(harness.events, [{kind: 'native', error, fatal: false}]);
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
        installCrashlyticsHandler(errorUtils, () => {
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
        assert.match(payload.frames[0].fn, /^YifyReactNative\.[a-p]{16}\.anonymous_TypeError$/);
        assert.equal(payload.frames[0].file, 'index.android.bundle:1:100');
        assert.equal(payload.frames[0].line, 1);
        assert.equal(payload.frames[0].col, 100);
        assert.equal(payload.frames[1].fn, 'onPress');
        assert.equal(payload.frames[1].file, 'index.android.bundle:1:800');
        assert.equal(payload.frames.some(frame => frame.file.includes('react-native-crash')), false);
        assert.equal(nativeEvents.at(-1).kind, 'original');
        assert.equal(nativeEvents.at(-1).error, original);

        // Exercise the real SDK conversion for A/B/A. The distinction must be on
        // an original source frame, because Crashlytics may ignore helper frames.
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
            // The real RNFB package creates its default instance and installs this
            // handler while the module is imported, before getCrashlytics is called.
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
