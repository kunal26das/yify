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
    const logReads = [];
    const reload = options.reload ?? deferred();
    const appState = {currentState: options.appState ?? 'active', addEventListener: (_event, listener) => {
        listeners.add(listener);
        return {remove: () => listeners.delete(listener)};
    }};
    const {ExpoAppUpdates} = loadTypeScript('data/services/ExpoAppUpdates.ts', {
        'react-native': {AppState: appState, Platform: {OS: options.platform ?? 'ios'}},
        'expo-updates': {
            isEnabled: options.enabled ?? true,
            channel: options.channel ?? 'Production',
            checkForUpdateAsync: async () => {
                calls.check += 1;
                return options.check ? options.check() : {isAvailable: true};
            },
            fetchUpdateAsync: async () => {calls.fetch += 1; return options.fetch ? options.fetch() : {isNew: true};},
            readLogEntriesAsync: async maxAge => {logReads.push(maxAge); return options.logs ? options.logs() : [];},
            reloadAsync: () => {calls.reload += 1; return reload.promise;},
        },
    });
    const diagnostics = {
        event: (...args) => events.push(args),
        capture: (...args) => failures.push(args),
        start: operation => {
            const span = {operation, finish: (outcome, attributes) => {span.outcome = outcome; span.attributes = attributes;},
                fail: (error, attributes) => {span.error = error; span.attributes = attributes;}};
            spans.push(span);
            return span;
        },
    };
    const service = new ExpoAppUpdates(diagnostics, options.network);
    const changeState = state => {
        appState.currentState = state;
        listeners.forEach(listener => listener(state));
    };
    return {service, calls, events, failures, spans, reload, listeners, changeState, logReads,
        foreground: () => changeState('active')};
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

test('Android keeps a downloaded OTA ready for cold start without tearing down the live native runtime', async () => {
    const f = fixture({platform: 'android'});
    f.service.start();
    await settled();
    f.service.restart();
    f.service.restart();
    f.foreground();
    await f.service.sync();
    assert.deepEqual(f.calls, {check: 1, fetch: 1, reload: 0});
    assert.deepEqual(f.service.getStatus(), {state: 'ready', progress: 1});
    assert.equal(f.events.filter(([operation]) => operation === 'updates.reload').length, 0);
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
        assert.deepEqual(f.spans[0].attributes, {error_code: code, updates_log_status: 'empty'});
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
        assert.deepEqual(f.spans[0].attributes, {error_code: 'unknown', updates_log_status: 'empty'});
    }
});

test('background startup and connectivity changes defer update work until the app is active', async () => {
    const listeners = new Set();
    const f = fixture({appState: 'background', network: {
        isOnline: () => true,
        subscribe: listener => {listeners.add(listener); return () => listeners.delete(listener);},
    }});
    f.service.start();
    listeners.forEach(listener => listener());
    await settled();
    assert.equal(f.calls.check, 0);
    f.foreground();
    await settled();
    assert.deepEqual(f.calls, {check: 1, fetch: 1, reload: 0});
});

test('backgrounding during a check defers downloading and recovers on foreground', async () => {
    const pending = deferred();
    const f = fixture({check: () => pending.promise});
    f.service.start();
    f.changeState('background');
    pending.resolve({isAvailable: true});
    await settled();
    assert.equal(f.calls.fetch, 0);
    assert.equal(f.service.getStatus().state, 'idle');
    f.foreground();
    await settled();
    assert.equal(f.calls.fetch, 1);
    assert.equal(f.service.getStatus().state, 'ready');
});

test('connectivity loss during download waits for network recovery without a spurious failure banner', async () => {
    let online = true;
    let pending = deferred();
    const listeners = new Set();
    const f = fixture({fetch: () => pending.promise, network: {
        isOnline: () => online,
        subscribe: listener => {listeners.add(listener); return () => listeners.delete(listener);},
    }});
    f.service.start();
    await settled();
    online = false;
    pending.reject(Object.assign(new Error('Request interrupted'), {code: 'ERR_UPDATES_FETCH'}));
    await settled();
    const span = f.spans.find(entry => entry.operation === 'updates.download');
    assert.equal(span.error, undefined);
    assert.equal(span.outcome, 'unavailable');
    assert.equal(span.attributes.reason, 'offline');
    assert.equal(f.service.getStatus().state, 'idle');
    pending = deferred();
    online = true;
    listeners.forEach(listener => listener());
    await settled();
    pending.resolve({isNew: true});
    await settled();
    assert.equal(f.service.getStatus().state, 'ready');
});

test('backgrounding never hides unexplained native failures or configuration defects', async () => {
    for (const code of ['ERR_UPDATES_CHECK', 'ERR_UPDATES_DISABLED', 'ERR_UPDATES_UNSUPPORTED_DIRECTIVE']) {
        const pending = deferred();
        const f = fixture({check: () => pending.promise});
        f.service.start();
        f.changeState('background');
        const error = Object.assign(new Error('Native failure'), {code});
        pending.reject(error);
        await settled();
        assert.equal(f.spans[0].error, error);
        assert.deepEqual(f.spans[0].attributes, {error_code: code, reason: 'background', updates_log_status: 'empty'});
    }
});

test('refreshing a stale online snapshot prevents a native check while disconnected', async () => {
    let online = true;
    const f = fixture({network: {
        isOnline: () => online,
        refresh: async () => { online = false; return online; },
        subscribe: () => () => {},
    }});
    await f.service.sync();
    assert.equal(f.calls.check, 0);
    assert.equal(f.service.getStatus().state, 'idle');
});

test('late network callbacks cannot misreport a confirmed offline OTA interruption as a crash', async () => {
    let online = true;
    let reads = 0;
    const listeners = new Set();
    let fail = true;
    const f = fixture({network: {
        isOnline: () => online,
        refresh: async () => { if (++reads === 2) online = false; return online; },
        subscribe: listener => { listeners.add(listener); return () => listeners.delete(listener); },
    }, check: async () => {
        if (fail) throw Object.assign(new Error('Interrupted'), {code: 'ERR_UPDATES_CHECK'});
        return {isAvailable: true};
    }});
    f.service.start();
    await settled();
    assert.equal(f.spans[0].error, undefined);
    assert.deepEqual(f.spans[0].attributes, {error_code: 'ERR_UPDATES_CHECK', reason: 'offline'});
    assert.equal(f.spans[0].outcome, 'unavailable');
    fail = false;
    online = true;
    listeners.forEach(listener => listener());
    await settled();
    assert.equal(f.service.getStatus().state, 'ready');
});

test('a failed connectivity refresh still records unexplained update errors', async () => {
    const error = Object.assign(new Error('Native failure'), {code: 'ERR_UPDATES_CHECK'});
    const f = fixture({network: {
        isOnline: () => true,
        refresh: async () => { throw new Error('Platform snapshot unavailable'); },
        subscribe: () => () => {},
    }, check: async () => { throw error; }});
    await f.service.sync();
    assert.equal(f.spans[0].error, error);
});

test('failure details belong to the failed download rather than the preceding check and preserve later retry', async t => {
    let now = 1000;
    t.mock.method(Date, 'now', () => now);
    const error = Object.assign(new Error('Private native URL https://assets.test/token'), {code: 'ERR_UPDATES_FETCH'});
    let fail = true;
    const f = fixture({
        check: async () => {now = 2000; return {isAvailable: true};},
        fetch: async () => {now = 3000; if (fail) throw error; return {isNew: true};},
        logs: async () => [
            {timestamp: 1500, code: 'UpdateHasInvalidSignature', level: 'error'},
            {timestamp: 2500, code: 'AssetsFailedToLoad', level: 'error', message: 'private', assetId: 'private'},
            {timestamp: 3001, code: 'InitializationError', level: 'error'},
        ],
    });
    await f.service.sync();
    const span = f.spans.find(item => item.operation === 'updates.download');
    assert.equal(span.error, error);
    assert.deepEqual(span.attributes, {error_code: 'ERR_UPDATES_FETCH', updates_log_status: 'captured',
        updates_log_code: 'AssetsFailedToLoad', updates_phase: 'asset'});
    assert.equal(f.service.getStatus().state, 'error');
    assert.deepEqual(f.logReads, [60000]);
    f.service.dismiss();
    fail = false;
    await f.service.sync();
    assert.deepEqual(f.calls, {check: 2, fetch: 2, reload: 0});
    assert.equal(f.service.getStatus().state, 'ready');
    assert.equal(f.spans.filter(item => item.error).length, 1);
    assert.deepEqual(f.logReads, [60000]);
});

test('success, empty results, background deferral and confirmed offline failures never read native logs', async () => {
    for (const options of [{}, {check: async () => ({isAvailable: false})}, {enabled: false}, {appState: 'background'}]) {
        const f = fixture(options);
        await f.service.sync();
        assert.deepEqual(f.logReads, []);
    }
    let online = true;
    const f = fixture({
        check: async () => {online = false; throw Object.assign(new Error('Offline'), {code: 'ERR_UPDATES_CHECK'});},
        network: {isOnline: () => online, subscribe: () => () => {}},
    });
    await f.service.sync();
    assert.deepEqual(f.logReads, []);
    assert.equal(f.spans[0].outcome, 'unavailable');
    assert.equal(f.spans[0].error, undefined);
});

test('a native log timeout preserves original failure, prevents overlap and releases the existing retry guard', async t => {
    t.mock.timers.enable({apis: ['setTimeout']});
    const original = Object.assign(new Error('Original update failure'), {code: 'ERR_UPDATES_CHECK'});
    const logs = deferred();
    let fail = true;
    const f = fixture({check: async () => {if (fail) throw original; return {isAvailable: false};}, logs: () => logs.promise});
    const first = f.service.sync();
    await settled();
    await f.service.sync();
    assert.equal(f.calls.check, 1);
    t.mock.timers.tick(250);
    await first;
    assert.equal(f.spans[0].error, original);
    assert.deepEqual(f.spans[0].attributes, {error_code: 'ERR_UPDATES_CHECK', updates_log_status: 'timeout'});
    logs.reject(new Error('Late diagnostics failure'));
    await settled();
    assert.equal(f.spans.filter(item => item.error).length, 1);
    assert.equal(f.service.getStatus().state, 'idle');
    fail = false;
    await f.service.sync();
    assert.equal(f.calls.check, 2);
    assert.deepEqual(f.logReads, [60000]);
});
