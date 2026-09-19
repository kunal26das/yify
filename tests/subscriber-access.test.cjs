const assert = require('node:assert/strict');
const {test} = require('node:test');
const {loadTypeScript} = require('./helpers/load-typescript.cjs');

const endpoint = 'https://yify.expo.app/api/subscriber-catalog/access?v=2';
const approved = () => Response.json({metadata: {allowed: true}, raw: {responses: []}});
const deferred = () => {
    let resolve;
    const promise = new Promise(finish => {resolve = finish;});
    return {promise, resolve};
};

function fixture(options = {}) {
    let session = {ready: true, account: {uid: 'first'}, ...options.session};
    let purchase = {ready: false, available: false, adsRemoved: false, expiresAt: null,
        willRenew: false, billingIssue: false, ...options.purchase};
    const authListeners = new Set(), purchaseListeners = new Set();
    const auth = {getSession: () => session, getIdToken: options.getIdToken ?? (async () => `token-${session.account?.uid}`),
        subscribe: listener => {authListeners.add(listener); return () => authListeners.delete(listener);}};
    const purchases = {getState: () => purchase,
        subscribe: listener => {purchaseListeners.add(listener); return () => purchaseListeners.delete(listener);}};
    const {SubscriberCatalogAccess} = loadTypeScript('data/services/SubscriberCatalogAccess.ts');
    return {access: new SubscriberCatalogAccess(auth, purchases),
        session(patch) {session = {...session, ...patch}; for (const listener of authListeners) listener();},
        purchase(patch) {purchase = {...purchase, ...patch}; for (const listener of purchaseListeners) listener();}};
}

test('signed-out access is denied without a network call and unresolved auth remains checking', async t => {
    t.mock.method(globalThis, 'fetch', async () => assert.fail('Anonymous access check reached network'));
    for (const [session, expected] of [[{account: null}, 'denied'], [{ready: false}, 'checking']]) {
        const {access} = fixture({session});
        const unsubscribe = access.subscribe(() => {}); t.after(unsubscribe);
        await access.refresh();
        assert.equal(access.getState(), expected);
    }
});

test('concurrent observers and refreshes share one server check, ignoring local paid hints as proof', async t => {
    const pending = deferred();
    const requests = [];
    t.mock.method(globalThis, 'fetch', async (url, options) => {requests.push({url, options}); return pending.promise;});
    const {access} = fixture({purchase: {adsRemoved: true, expiresAt: '2099-01-01T00:00:00.000Z'}});
    assert.equal(access.getState(), 'checking');
    assert.equal(requests.length, 0, 'construction does not perform a check');
    const unsubscribe = access.subscribe(() => {}); t.after(unsubscribe);
    const unsubscribeSecond = access.subscribe(() => {}); t.after(unsubscribeSecond);
    const first = access.refresh(), second = access.refresh();
    assert.equal(first, second);
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(requests.length, 1);
    assert.equal(requests[0].url, endpoint);
    assert.equal(requests[0].options.headers.Authorization, 'Bearer token-first');
    assert.equal(requests[0].options.cache, 'no-store');
    pending.resolve(approved()); await first;
    assert.equal(access.getState(), 'allowed');
});

test('owner and server-approved grace access work without an initialized SDK or unexpired local purchase', async t => {
    t.mock.method(globalThis, 'fetch', async () => approved());
    for (const purchase of [{ready: false, adsRemoved: false}, {adsRemoved: true, expiresAt: '2000-01-01T00:00:00Z'}]) {
        const {access} = fixture({purchase});
        await access.refresh();
        assert.equal(access.getState(), 'allowed');
    }
});

test('same-identity manual verification retains allowed state until a server decision', async t => {
    const pending = deferred();
    let calls = 0;
    t.mock.method(globalThis, 'fetch', async () => ++calls === 1 ? approved() : pending.promise);
    const {access} = fixture();
    await access.refresh();
    const refreshing = access.refresh();
    assert.equal(access.getState(), 'allowed');
    pending.resolve(Response.json({error: 'Denied'}, {status: 403})); await refreshing;
    assert.equal(access.getState(), 'denied');
});

test('denial, verification failures and malformed metadata remain distinct and expose no raw fields', async t => {
    for (const [reply, expected] of [
        [() => Response.json({}, {status: 401}), 'denied'], [() => Response.json({}, {status: 403}), 'denied'],
        [() => Response.json({}, {status: 503}), 'unavailable'], [() => Response.json({}, {status: 429}), 'unavailable'],
        [() => {throw new Error('PRIVATE_NETWORK_DETAILS');}, 'unavailable'],
        [() => Response.json({allowed: true}), 'unavailable'],
        [() => Response.json({metadata: {allowed: 'true'}}), 'unavailable'],
        [() => Response.json({metadata: {allowed: false}}), 'unavailable'],
        [() => Response.json({metadata: {allowed: true, raw: 'PRIVATE'}}), 'unavailable'],
    ]) {
        t.mock.method(globalThis, 'fetch', async () => reply());
        const {access} = fixture();
        await access.refresh();
        assert.equal(access.getState(), expected);
    }
    t.mock.method(globalThis, 'fetch', async () => ({ok: true, status: 200, json: async () => {
        const envelope = {metadata: {allowed: true}};
        Object.defineProperty(envelope, 'raw', {get() {assert.fail('Access gate consumed raw response');}});
        return envelope;
    }}));
    const {access} = fixture(); await access.refresh();
    assert.equal(access.getState(), 'allowed');
});

test('sign-out immediately invalidates allowed access and ignores an unfinished verification body', async t => {
    const pending = deferred(), started = deferred();
    let calls = 0, signal;
    t.mock.method(globalThis, 'fetch', async (_url, options) => {
        if (++calls === 1) return approved();
        signal = options.signal;
        return {ok: true, status: 200, json() {started.resolve(); return pending.promise;}};
    });
    const f = fixture(); await f.access.refresh();
    const checking = f.access.refresh(); await started.promise;
    f.session({account: null});
    assert.equal(f.access.getState(), 'denied');
    assert.equal(signal.aborted, true);
    pending.resolve({metadata: {allowed: true}}); await checking;
    assert.equal(f.access.getState(), 'denied');
});

test('account switches cancel old verification and coalesce a new check for mounted observers', async t => {
    const first = deferred(), second = deferred();
    const requests = [];
    t.mock.method(globalThis, 'fetch', async (url, options) => {
        requests.push({url, options});
        return requests.length === 1 ? first.promise : second.promise;
    });
    const f = fixture(); const unsubscribe = f.access.subscribe(() => {}); t.after(unsubscribe);
    const oldCheck = f.access.refresh(); await new Promise(resolve => setImmediate(resolve));
    f.session({account: {uid: 'second'}});
    assert.equal(f.access.getState(), 'checking');
    assert.equal(requests[0].options.signal.aborted, true);
    const latestCheck = f.access.refresh(); await new Promise(resolve => setImmediate(resolve));
    assert.equal(requests.length, 2);
    assert.equal(requests[1].options.headers.Authorization, 'Bearer token-second');
    first.resolve(approved()); await oldCheck;
    assert.equal(f.access.getState(), 'checking');
    second.resolve(Response.json({}, {status: 403})); await latestCheck;
    assert.equal(f.access.getState(), 'denied');
});

test('purchase context changes clear a grant immediately and verify again while observed', async t => {
    const pending = deferred(); let calls = 0;
    t.mock.method(globalThis, 'fetch', async () => ++calls === 1 ? approved() : pending.promise);
    const f = fixture(); const unsubscribe = f.access.subscribe(() => {}); t.after(unsubscribe);
    await f.access.refresh();
    f.purchase({expiresAt: '2000-01-01T00:00:00.000Z', billingIssue: true});
    assert.equal(f.access.getState(), 'checking');
    const checked = f.access.refresh();
    pending.resolve(Response.json({}, {status: 403})); await checked;
    assert.equal(f.access.getState(), 'denied');
    assert.equal(calls, 2);
});

test('an Anime denial invalidates a pending older access approval', async t => {
    const pending = deferred(), started = deferred(); let accessCalls = 0;
    t.mock.method(globalThis, 'fetch', async url => {
        if (url.includes('/anime')) return Response.json({}, {status: 403});
        if (++accessCalls === 1) return approved();
        return {ok: true, status: 200, json() {started.resolve(); return pending.promise;}};
    });
    const {access} = fixture(); await access.refresh();
    const oldApproval = access.refresh(); await started.promise;
    assert.equal(await access.load('https://yify.expo.app/api/subscriber-catalog/anime?v=2', value => value), null);
    assert.equal(access.getState(), 'denied');
    pending.resolve({metadata: {allowed: true}}); await oldApproval;
    assert.equal(access.getState(), 'denied');
});

test('known expiry invalidates and reverifies once while observed without polling past owner/grace dates', async t => {
    t.mock.timers.enable({apis: ['setTimeout']});
    let now = 1_000;
    t.mock.method(Date, 'now', () => now);
    let calls = 0;
    const pending = deferred();
    t.mock.method(globalThis, 'fetch', async () => ++calls === 1 ? approved() : pending.promise);
    const f = fixture({purchase: {adsRemoved: true, expiresAt: new Date(2000).toISOString()}});
    const unsubscribe = f.access.subscribe(() => {}); t.after(unsubscribe);
    await f.access.refresh(); assert.equal(f.access.getState(), 'allowed');
    now = 2000; t.mock.timers.tick(1000);
    assert.equal(f.access.getState(), 'checking');
    const expiryCheck = f.access.refresh();
    pending.resolve(approved()); await expiryCheck;
    assert.equal(f.access.getState(), 'allowed', 'server can approve the owner or grace period');
    now += 120_000; t.mock.timers.tick(120_000);
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(calls, 2, 'an already-checked past expiry does not start a verification loop');
});

test('verification timeout becomes unavailable and later manual retry can recover', async t => {
    t.mock.timers.enable({apis: ['setTimeout']});
    let calls = 0, signal;
    t.mock.method(globalThis, 'fetch', async (_url, options) => {
        signal = options.signal;
        return ++calls === 1 ? new Promise(() => {}) : approved();
    });
    const {access} = fixture(); const checking = access.refresh();
    await new Promise(resolve => setImmediate(resolve));
    t.mock.timers.tick(30_000); await checking;
    assert.equal(signal.aborted, true);
    assert.equal(access.getState(), 'unavailable');
    await access.refresh(); assert.equal(access.getState(), 'allowed');
});
