const assert = require('node:assert/strict');
const {test} = require('node:test');
const {loadTypeScript} = require('./helpers/load-typescript.cjs');

const {createSentryGlobalErrorReporter} = loadTypeScript('instrumentation/sentry-global.ts');
const {installCrashlyticsHandler} = loadTypeScript('instrumentation/crashlytics-handler.ts');

test('uncaught React render errors keep component locations in Sentry without mutating the original', async () => {
    const error = {
        name: 'TypeError', message: 'Render failed', stack: 'TypeError: Render failed',
        componentStack: '\n    at MovieCard (address at index.android.bundle:1:123)\n    at Browse (address at index.android.bundle:1:900)',
    };
    const snapshot = structuredClone(error);
    let captured;
    const reporter = createSentryGlobalErrorReporter({
        captureException: (copy, hint) => { captured = {copy, hint}; return 'event-id'; },
        flush: async () => true,
    }, () => {});
    await reporter(error, true);
    assert.ok(captured.copy instanceof Error);
    assert.match(captured.copy.stack, /MovieCard.*index.android.bundle:1:123/);
    assert.equal(captured.copy.name, 'TypeError');
    assert.equal(captured.hint.originalException, error);
    assert.deepEqual(error, snapshot);
});

test('global reporting preserves the original exception and its true fatal classification', async () => {
    for (const fatal of [true, false]) {
        const calls = [];
        const error = new Error('Crash');
        const reporter = createSentryGlobalErrorReporter({
            captureException: (...args) => { calls.push(['capture', ...args]); return 'event-id'; },
            flush: async timeout => { calls.push(['flush', timeout]); return true; },
        }, id => calls.push(['correlate', id]));
        await reporter(error, fatal);
        assert.deepEqual(calls[0], ['capture', error, {
            originalException: error,
            mechanism: {type: 'yify.react_native.global', handled: !fatal},
            captureContext: {level: fatal ? 'fatal' : 'error'},
        }]);
        assert.ok(calls.some(call => call[0] === 'correlate' && call[1] === 'event-id'));
        assert.ok(calls.some(call => call[0] === 'flush' && call[1] === 2000));
    }
});

test('failed and hung Sentry uploads cannot prevent Firebase fatal persistence', async () => {
    for (const failure of ['capture', 'flush', 'hang', 'correlation']) {
        const calls = [];
        let current = () => calls.push('original');
        const errorUtils = {getGlobalHandler: () => current, setGlobalHandler: handler => { current = handler; }};
        const reporter = createSentryGlobalErrorReporter({
            captureException: () => {
                if (failure === 'capture') throw new Error('Capture unavailable');
                return 'event-id';
            },
            flush: () => {
                if (failure === 'flush') return Promise.reject(new Error('Flush failed'));
                if (failure === 'hang') return new Promise(() => {});
                return Promise.resolve(true);
            },
        }, () => {
            if (failure === 'correlation') throw new Error('Metadata failed');
        }, 10);
        installCrashlyticsHandler(errorUtils, () => {
            current = async () => calls.push('firebase');
            return {isCrashlyticsCollectionEnabled: true};
        }, () => calls.push('nonfatal'), undefined, reporter);
        await current(new Error('Real crash'), true);
        assert.deepEqual(calls, ['firebase', 'original'], failure);
    }
});
