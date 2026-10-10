const assert = require('node:assert/strict');
const {test} = require('node:test');
const {loadTypeScript} = require('./helpers/load-typescript.cjs');

const settled = () => new Promise(resolve => setImmediate(resolve));

function fixture(t, {online = true, fetcher = async () => ({status: 200})} = {}) {
    const original = Object.fromEntries(['window', 'navigator', 'document', 'fetch'].map(key =>
        [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
    const restore = key => original[key]
        ? Object.defineProperty(globalThis, key, original[key])
        : delete globalThis[key];
    t.after(() => ['window', 'navigator', 'document', 'fetch'].forEach(restore));

    const handlers = new Map();
    const browser = {
        location: {href: 'https://yify.example/movies?source=home', origin: 'https://yify.example', pathname: '/movies'},
        addEventListener(name, listener) {
            if (!handlers.has(name)) handlers.set(name, new Set());
            handlers.get(name).add(listener);
        },
        removeEventListener(name, listener) { handlers.get(name)?.delete(listener); },
    };
    Object.defineProperty(globalThis, 'window', {configurable: true, value: browser});
    Object.defineProperty(globalThis, 'navigator', {configurable: true, value: {get onLine() { return online; }}});
    let visibility = 'visible';
    Object.defineProperty(globalThis, 'document', {configurable: true,
        value: {get visibilityState() { return visibility; }}});
    Object.defineProperty(globalThis, 'fetch', {configurable: true, value: fetcher});

    let foreground;
    let foregroundStops = 0;
    const {ExpoNetworkMonitor} = loadTypeScript('data/services/ExpoNetworkMonitor.web.ts', {
        '../datasources/platform/ForegroundWatcher': {
            watchForeground: listener => {
                foreground = listener;
                return () => { foregroundStops++; foreground = undefined; };
            },
        },
    });
    const monitor = new ExpoNetworkMonitor();
    return {
        monitor,
        setBrowserOnline(value) { online = value; },
        setVisibility(value) { visibility = value; },
        emit(name) { for (const listener of handlers.get(name) ?? []) listener(); },
        listenerCount(name) { return handlers.get(name)?.size ?? 0; },
        foreground() { foreground?.(); },
        foregroundStops: () => foregroundStops,
    };
}

test('server rendering starts optimistic and makes no network request', async t => {
    const original = Object.fromEntries(['window', 'navigator', 'fetch'].map(key =>
        [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
    t.after(() => {
        for (const key of Object.keys(original)) {
            if (original[key]) Object.defineProperty(globalThis, key, original[key]);
            else delete globalThis[key];
        }
    });
    delete globalThis.window;
    delete globalThis.navigator;
    Object.defineProperty(globalThis, 'fetch', {configurable: true, value: () => assert.fail('server probe')});
    const {ExpoNetworkMonitor} = loadTypeScript('data/services/ExpoNetworkMonitor.web.ts', {
        '../datasources/platform/ForegroundWatcher': {watchForeground: () => assert.fail('server listener')},
    });
    const monitor = new ExpoNetworkMonitor();
    assert.equal(monitor.isOnline(), true);
    assert.equal(await monitor.refresh(), true);
});

test('a false browser flag is repaired by any same-origin HTTP response and proof is reused', async t => {
    const calls = [];
    const f = fixture(t, {online: false, fetcher: async (url, init) => {
        calls.push({url, init});
        return {status: 503};
    }});
    await settled();
    assert.equal(f.monitor.isOnline(), true);
    assert.equal(await f.monitor.refresh(), true);
    assert.equal(calls.length, 1);
    assert.equal(calls[0].url, 'https://yify.example/movies');
    assert.equal(calls[0].init.method, 'HEAD');
    assert.equal(calls[0].init.credentials, 'omit');
    assert.equal(calls[0].init.cache, 'no-store');
    assert.equal(calls[0].init.redirect, 'manual');
});

test('first subscribe and resubscribe refresh changes missed while nobody listened', async t => {
    let reachable = false;
    const f = fixture(t, {fetcher: async () => {
        if (!reachable) throw new TypeError('Failed to fetch');
        return {status: 404};
    }});
    f.setBrowserOnline(false);
    const first = f.monitor.subscribe(() => {});
    await settled();
    assert.equal(f.monitor.isOnline(), false);
    first();

    f.setBrowserOnline(true);
    const second = f.monitor.subscribe(() => {});
    assert.equal(f.monitor.isOnline(), true);
    second();

    f.setBrowserOnline(false);
    reachable = true;
    const third = f.monitor.subscribe(() => {});
    await settled();
    assert.equal(f.monitor.isOnline(), true);
    third();
    assert.equal(f.listenerCount('online'), 0);
    assert.equal(f.listenerCount('offline'), 0);
    assert.equal(f.foregroundStops(), 3);
});

test('concurrent refreshes share one same-origin probe', async t => {
    let complete;
    let calls = 0;
    const f = fixture(t, {online: false, fetcher: () => {
        calls++;
        return new Promise(resolve => { complete = resolve; });
    }});
    const first = f.monitor.refresh();
    const second = f.monitor.refresh();
    assert.equal(first, second);
    await settled();
    assert.equal(calls, 1);
    complete({status: 404});
    assert.equal(await first, true);
    assert.equal(f.monitor.isOnline(), true);
});

test('genuine offline state recovers on browser events and releases listeners', async t => {
    const f = fixture(t, {online: false, fetcher: async () => { throw new TypeError('Failed to fetch'); }});
    const observed = [];
    const unsubscribe = f.monitor.subscribe(() => observed.push(f.monitor.isOnline()));
    await settled();
    assert.equal(f.monitor.isOnline(), false);
    assert.deepEqual(observed, [false]);
    assert.equal(f.listenerCount('online'), 1);
    assert.equal(f.listenerCount('offline'), 1);

    f.setBrowserOnline(true);
    f.emit('online');
    assert.equal(f.monitor.isOnline(), true);
    f.setBrowserOnline(false);
    f.emit('offline');
    await settled();
    assert.equal(f.monitor.isOnline(), false);
    assert.deepEqual(observed, [false, true, false]);

    unsubscribe();
    assert.equal(f.listenerCount('online'), 0);
    assert.equal(f.listenerCount('offline'), 0);
    assert.equal(f.foregroundStops(), 1);
    f.setBrowserOnline(true);
    f.emit('online');
    assert.deepEqual(observed, [false, true, false]);
});

test('visible confirmed outages retry without browser events and stop after recovery or cleanup', async t => {
    t.mock.timers.enable({apis: ['setTimeout']});
    let reachable = false;
    let probes = 0;
    const f = fixture(t, {online: false, fetcher: async () => {
        probes++;
        if (!reachable) throw new TypeError('Offline');
        return {status: 503};
    }});
    const unsubscribe = f.monitor.subscribe(() => {});
    await settled();
    assert.equal(f.monitor.isOnline(), false);
    assert.equal(probes, 1);

    reachable = true;
    t.mock.timers.tick(10000);
    await settled();
    assert.equal(f.monitor.isOnline(), true);
    assert.equal(probes, 2);
    t.mock.timers.tick(10000);
    await settled();
    assert.equal(probes, 2);

    reachable = false;
    f.emit('offline');
    await settled();
    assert.equal(f.monitor.isOnline(), false);
    assert.equal(probes, 3);
    unsubscribe();
    t.mock.timers.tick(10000);
    await settled();
    assert.equal(probes, 3);
});

test('hidden outages do not poll and foreground recovery resumes the check', async t => {
    t.mock.timers.enable({apis: ['setTimeout']});
    let probes = 0;
    const f = fixture(t, {online: false, fetcher: async () => {
        probes++;
        throw new TypeError('Offline');
    }});
    const unsubscribe = f.monitor.subscribe(() => {});
    await settled();
    assert.equal(f.monitor.isOnline(), false);
    f.setVisibility('hidden');
    t.mock.timers.tick(10000);
    await settled();
    assert.equal(probes, 1);
    f.setVisibility('visible');
    f.foreground();
    await settled();
    assert.equal(probes, 2);
    unsubscribe();
});

test('provider CORS failures remain request errors while the browser is online', async t => {
    let probes = 0;
    const f = fixture(t, {fetcher: async () => { probes++; throw new TypeError('Blocked probe'); }});
    const records = [];
    const {requestJson} = loadTypeScript('data/datasources/JsonRequest.ts');
    const failure = new TypeError('Failed to fetch');
    let providerCalls = 0;
    await assert.rejects(requestJson('https://provider.example/catalog', {
        diagnostics: {start: () => ({finish: () => {}, fail: (error, data) => records.push({error, data})})},
        operation: 'api.catalog.movies', provider: 'catalog', timeoutMs: 1000,
        network: f.monitor,
        fetcher: async () => { providerCalls++; throw failure; },
        parse: body => body,
    }), error => error === failure);
    assert.equal(providerCalls, 2);
    assert.equal(probes, 0);
    assert.equal(f.monitor.isOnline(), true);
    assert.equal(records.length, 1);
    assert.equal(records[0].data.error_code, 'network_error');
});

test('late failed probes cannot overwrite reconnect events and foreground rechecks stale browser flags', async t => {
    const pending = [];
    const f = fixture(t, {online: false, fetcher: () => new Promise((resolve, reject) => pending.push({resolve, reject}))});
    const observed = [];
    f.monitor.subscribe(() => observed.push(f.monitor.isOnline()));
    await settled();
    assert.equal(pending.length, 1);
    f.setBrowserOnline(true);
    f.emit('online');
    pending[0].reject(new TypeError('Old offline probe'));
    await settled();
    assert.equal(f.monitor.isOnline(), true);

    f.setBrowserOnline(false);
    f.emit('offline');
    await settled();
    assert.equal(pending.length, 2);
    pending[1].reject(new TypeError('Offline'));
    await settled();
    assert.equal(f.monitor.isOnline(), false);

    f.foreground();
    await settled();
    assert.equal(pending.length, 3);
    pending[2].resolve({status: 404});
    await settled();
    assert.equal(f.monitor.isOnline(), true);
    assert.deepEqual(observed, [false, true]);
});

test('a hung same-origin probe is bounded and cannot overwrite a later reconnect', async t => {
    t.mock.timers.enable({apis: ['setTimeout']});
    let complete;
    const f = fixture(t, {online: false, fetcher: () => new Promise(resolve => { complete = resolve; })});
    f.monitor.subscribe(() => {});
    await settled();
    const pending = f.monitor.refresh();
    t.mock.timers.tick(3000);
    assert.equal(await pending, false);
    assert.equal(f.monitor.isOnline(), false);
    f.setBrowserOnline(true);
    f.emit('online');
    complete({status: 200});
    await settled();
    assert.equal(f.monitor.isOnline(), true);
    assert.equal(await f.monitor.refresh(), true);
});
