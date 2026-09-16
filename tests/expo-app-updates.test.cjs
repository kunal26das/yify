const assert = require('node:assert/strict');
const {test} = require('node:test');
const {loadTypeScript} = require('./helpers/load-typescript.cjs');

const settled = () => new Promise(resolve => setImmediate(resolve));
const deferred = () => {
    let resolve;
    let reject;
    const promise = new Promise((done, fail) => {resolve = done; reject = fail;});
    return {promise, resolve, reject};
};

function fixture(options = {}) {
    const listeners = new Set();
    const calls = {check: 0, fetch: 0, reload: 0};
    const events = [];
    const failures = [];
    const spans = [];
    const reload = options.reload ?? deferred();
    const {ExpoAppUpdates} = loadTypeScript('data/services/ExpoAppUpdates.ts', {
        'react-native': {AppState: {addEventListener: (_event, listener) => {
            listeners.add(listener);
            return {remove: () => listeners.delete(listener)};
        }}},
        'expo-updates': {
            isEnabled: options.enabled ?? true,
            channel: options.channel ?? 'Production',
            checkForUpdateAsync: async () => {
                calls.check += 1;
                return options.check ? options.check() : {isAvailable: true};
            },
            fetchUpdateAsync: async () => {calls.fetch += 1; return {isNew: true};},
            reloadAsync: () => {calls.reload += 1; return reload.promise;},
        },
    });
    const diagnostics = {
        event: (...args) => events.push(args),
        capture: (...args) => failures.push(args),
        start: operation => {
            const span = {operation, finish: outcome => {span.outcome = outcome;},
                fail: (error, attributes) => {span.error = error; span.attributes = attributes;}};
            spans.push(span);
            return span;
        },
    };
    const service = new ExpoAppUpdates(diagnostics, options.network);
    return {service, calls, events, failures, spans, reload, listeners,
        foreground: () => listeners.forEach(listener => listener('active'))};
}

test('a downloaded update stays ready when returning from a native dialog or foregrounding repeatedly', async () => {
    const f = fixture();
    f.service.start();
    await settled();
    assert.deepEqual(f.service.getStatus(), {state: 'ready', progress: 1});
    f.foreground();
    f.foreground();
    await settled();
    assert.deepEqual(f.calls, {check: 1, fetch: 1, reload: 0});
    assert.deepEqual(f.service.getStatus(), {state: 'ready', progress: 1});
});

test('rapid restart taps and foreground callbacks produce only one native reload', async () => {
    const f = fixture();
    f.service.start();
    await settled();
    f.service.restart();
    f.service.restart();
    f.foreground();
    await f.service.sync();
    assert.deepEqual(f.calls, {check: 1, fetch: 1, reload: 1});
    assert.deepEqual(f.service.getStatus(), {state: 'installing', progress: 1});
    assert.equal(f.events.filter(([operation]) => operation === 'updates.reload').length, 1);
    f.reload.resolve();
    await settled();
    f.service.restart();
    f.foreground();
    assert.deepEqual(f.calls, {check: 1, fetch: 1, reload: 1});
});

test('failed native reload restores the ready update and permits an explicit retry', async () => {
    const f = fixture();
    await f.service.sync();
    f.service.restart();
    const error = new Error('Reload unavailable');
    f.reload.reject(error);
    await settled();
    assert.deepEqual(f.service.getStatus(), {state: 'ready', progress: 1});
    assert.deepEqual(f.failures, [[error, 'updates.reload', {provider: 'expo', error_code: 'unknown'}]]);
    f.service.restart();
    assert.equal(f.calls.reload, 2);
    await settled();
});

test('restart does nothing until a compatible update has downloaded', async () => {
    const f = fixture({check: async () => ({isAvailable: false})});
    f.service.restart();
    await f.service.sync();
    f.service.restart();
    assert.equal(f.calls.reload, 0);
});

test('foreground checks continue when no update is pending and startup registers one listener', async () => {
    const f = fixture({check: async () => ({isAvailable: false})});
    f.service.start();
    f.service.start();
    await settled();
    f.foreground();
    await settled();
    assert.deepEqual(f.calls, {check: 2, fetch: 0, reload: 0});
    assert.equal(f.listeners.size, 1);
});

test('foreground events cannot overlap an update check already in progress', async () => {
    const check = deferred();
    const f = fixture({check: () => check.promise});
    f.service.start();
    f.foreground();
    f.foreground();
    assert.equal(f.calls.check, 1);
    check.resolve({isAvailable: false});
    await settled();
    assert.equal(f.calls.fetch, 0);
});

test('disabled updates and unconfigured channels do not make native update requests', async () => {
    for (const options of [{enabled: false}, {channel: ''}]) {
        const f = fixture(options);
        f.service.start();
        f.foreground();
        f.service.restart();
        await settled();
        assert.deepEqual(f.calls, {check: 0, fetch: 0, reload: 0});
    }
});

test('confirmed offline updates wait for connectivity and retry once the network returns', async () => {
    let online = false;
    const listeners = new Set();
    const network = {isOnline: () => online, subscribe: listener => {
        listeners.add(listener);
        return () => listeners.delete(listener);
    }};
    const f = fixture({network});
    f.service.start();
    f.service.start();
    f.foreground();
    await settled();
    assert.deepEqual(f.calls, {check: 0, fetch: 0, reload: 0});
    assert.equal(listeners.size, 1);
    assert.equal(f.events.at(-1)[1].reason, 'offline');
    online = true;
    listeners.forEach(listener => listener());
    await settled();
    assert.deepEqual(f.calls, {check: 1, fetch: 1, reload: 0});
    assert.deepEqual(f.service.getStatus(), {state: 'ready', progress: 1});
});

test('native update check codes remain captured and distinguish configuration failures from generic check failures', async () => {
    for (const code of ['ERR_UPDATES_CHECK', 'ERR_UPDATES_DISABLED', 'ERR_NOT_AVAILABLE_IN_DEV_CLIENT']) {
        const error = Object.assign(new Error('Native failure'), {name: 'CodedError', code});
        let rejected = true;
        const f = fixture({
            network: {isOnline: () => true, subscribe: () => () => {}},
            check: async () => {
                if (rejected) throw error;
                return {isAvailable: true};
            },
        });
        await f.service.sync();
        assert.equal(f.spans[0].error, error);
        assert.deepEqual(f.spans[0].attributes, {error_code: code});
        assert.deepEqual(f.service.getStatus(), {state: 'idle', progress: 0});
        rejected = false;
        await f.service.sync();
        assert.equal(f.calls.check, 2);
        assert.equal(f.service.getStatus().state, 'ready');
    }
});

test('unknown update failures remain captured without leaking arbitrary native codes into diagnostics', async () => {
    for (const error of [
        Object.assign(new Error('Native failure'), {name: 'CodedError', code: 'private@example.com'}),
        new Error('Unknown update error'),
        Object.defineProperty(new Error('Unreadable error'), 'code', {get: () => {throw new Error('Denied');}}),
    ]) {
        const f = fixture({check: async () => {throw error;}});
        await assert.doesNotReject(f.service.sync());
        assert.equal(f.spans[0].error, error);
        assert.deepEqual(f.spans[0].attributes, {error_code: 'unknown'});
    }
});
