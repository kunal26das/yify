const assert = require('node:assert/strict');
const {test} = require('node:test');
const {loadTypeScript} = require('./helpers/load-typescript.cjs');

const flush = () => new Promise(setImmediate);
function deferred() {
    let resolve;
    const promise = new Promise((done) => { resolve = done; });
    return {promise, resolve};
}

function syncFixture(t, options = {}) {
    t.mock.timers.enable({apis: ['setTimeout', 'setInterval']});
    const remote = new Map();
    const calls = [];
    let foreground;
    let movies = [{id: 123}];
    let library = {watched: {}, collections: {}, memberships: {}, clearedAt: 0};
    let history = {entries: [], removed: {}, clearedAt: 0};
    let preferences = {
        theme: 'dark',
        browseDefaults: {sort_by: 'date_added', order_by: 'desc', quality: 'all', genre: 'all', minimum_rating: 0},
    };
    const domain = loadTypeScript('domain/index.ts');
    const {AccountSyncImpl} = loadTypeScript('data/services/AccountSyncImpl.ts', {
        '@/domain': domain,
        '../datasources/platform/ForegroundWatcher': {
            isForeground: () => true,
            watchForeground: (listener) => { foreground = listener; },
        },
        '../datasources/sync/FirestoreSyncDataSource': {
            MAX_WATCHLIST_CHARS: 500000,
            MAX_PREFERENCES_CHARS: 4000,
            MAX_HISTORY_CHARS: 150000,
            MAX_LIBRARY_CHARS: 300000,
            fetchSyncDocument: async (uid) => {
                calls.push(`read:${uid}`);
                await options.beforeRead?.();
                if (options.readFailure) return {ok: false, failure: options.readFailure, detail: 'Request rejected'};
                return {ok: true, document: remote.get(uid) ?? {}};
            },
            writeSyncDocument: async (uid, token, patch) => {
                calls.push(`write-start:${uid}`);
                await options.beforeWrite?.();
                remote.set(uid, {...remote.get(uid), ...patch});
                calls.push(`write-end:${uid}`);
                return {ok: true};
            },
            deleteSyncDocument: async (uid) => {
                calls.push(`delete:${uid}`);
                if (options.deleteFails) return {ok: false, failure: 'network', detail: 'offline'};
                remote.delete(uid);
                return {ok: true};
            },
        },
    });
    const values = new Map();
    const sync = new AccountSyncImpl({
        store: {
            getString: (key) => values.get(key),
            set: (key, value) => values.set(key, value),
            delete: (key) => values.delete(key),
        },
        auth: {getIdToken: async () => {
            if (options.tokenFailure) throw new domain.AuthTokenError(options.tokenFailure);
            return options.getIdToken ? options.getIdToken() : 'test-token';
        }},
        diagnostics: options.diagnostics,
        watchlist: {
            getAll: () => movies,
            applyRemote: (next) => { movies = next; },
            subscribe: () => () => {},
        },
        library: {
            setMutationBlocked: () => {},
            getState: () => library,
            applyRemote: (next) => { library = next; },
            subscribe: () => () => {},
        },
        watchHistory: {
            getState: () => history,
            applyRemote: (next) => { history = next; },
            subscribe: () => () => {},
        },
        preferences: {
            getSynced: () => preferences,
            getDefaultSynced: () => preferences,
            applyRemote: (next) => { preferences = next; },
            subscribe: () => () => {},
        },
    });
    sync.start();
    return {sync, calls, remote, foreground: () => foreground(), movies: () => movies};
}

test('account deletion drains an active upload and blocks foreground and poll resurrection', async (t) => {
    const write = deferred();
    const {sync, calls, remote, foreground} = syncFixture(t, {beforeWrite: () => write.promise});
    sync.setAccount('account-a');
    await flush();
    assert.ok(calls.includes('write-start:account-a'));

    let drained = false;
    const paused = sync.pause().then(() => { drained = true; });
    await flush();
    assert.equal(drained, false);
    write.resolve();
    await paused;
    assert.equal(await sync.deleteRemote(), true);
    assert.ok(calls.indexOf('write-end:account-a') < calls.indexOf('delete:account-a'));

    const afterDelete = [...calls];
    foreground();
    sync.syncNow();
    t.mock.timers.tick(60000);
    await flush();
    assert.deepEqual(calls, afterDelete);
    assert.equal(remote.has('account-a'), false);

    sync.setAccount(null);
    sync.resume();
    await flush();
    assert.equal(remote.has('account-a'), false);
    assert.deepEqual(calls, afterDelete);
});

test('cancelled auth deletion can resume and restore sync for the original account', async (t) => {
    const {sync, remote} = syncFixture(t);
    sync.setAccount('account-a');
    await flush();
    await sync.pause();
    assert.equal(await sync.deleteRemote(), true);
    assert.equal(remote.has('account-a'), false);

    sync.setAccount('account-a');
    sync.resume();
    await flush();
    assert.equal(remote.has('account-a'), true);
    assert.equal(JSON.parse(remote.get('account-a').watchlist).items[0].id, 123);
});

test('pausing during a read abandons its merge and prevents a following upload', async (t) => {
    const read = deferred();
    const {sync, calls} = syncFixture(t, {beforeRead: () => read.promise});
    sync.setAccount('account-a');
    await flush();
    const paused = sync.pause();
    read.resolve();
    await paused;
    assert.equal(await sync.deleteRemote(), true);
    assert.deepEqual(calls, ['read:account-a', 'delete:account-a']);
});

test('account changes stay paused until the deletion flow resumes the actual account', async (t) => {
    const {sync, calls} = syncFixture(t);
    sync.setAccount('account-a');
    await flush();
    await sync.pause();
    const beforeChange = [...calls];
    sync.setAccount('account-b');
    await flush();
    assert.deepEqual(calls, beforeChange);
    sync.resume();
    await flush();
    assert.ok(calls.slice(beforeChange.length).includes('read:account-b'));
    assert.equal(calls.slice(beforeChange.length).some((call) => call.endsWith('account-a')), false);
});

test('deleting one account never copies its retained local data into another account', async (t) => {
    const {sync, remote, movies} = syncFixture(t);
    remote.set('account-b', {
        watchlist: JSON.stringify({items: [{id: 456}], marks: {}}),
        preferences: JSON.stringify({theme: 'light', browseDefaults: {}}),
    });
    sync.setAccount('account-a');
    await flush();
    assert.deepEqual(movies().map((movie) => movie.id), [123]);
    await sync.pause();
    assert.equal(await sync.deleteRemote(), true);
    sync.setAccount('account-b');
    sync.resume();
    await flush();
    assert.deepEqual(movies().map((movie) => movie.id), [456]);
    assert.deepEqual(JSON.parse(remote.get('account-b').watchlist).items.map((movie) => movie.id), [456]);
    assert.equal(remote.has('account-a'), false);
});

test('deletion before the first merge still attributes retained local data to the deleted account', async (t) => {
    const firstRead = deferred();
    const {sync, remote, movies} = syncFixture(t, {beforeRead: () => firstRead.promise});
    remote.set('account-b', {
        watchlist: JSON.stringify({items: [{id: 456}], marks: {}}),
    });
    sync.setAccount('account-a');
    await flush();
    const paused = sync.pause();
    firstRead.resolve();
    await paused;
    assert.equal(await sync.deleteRemote(), true);
    sync.setAccount('account-b');
    sync.resume();
    await flush();
    assert.deepEqual(movies().map((movie) => movie.id), [456]);
    assert.deepEqual(JSON.parse(remote.get('account-b').watchlist).items.map((movie) => movie.id), [456]);
});

test('identity changes while obtaining a deletion token prevent deleting either sync document', async (t) => {
    const token = deferred();
    let waitForToken = false;
    const {sync, calls} = syncFixture(t, {
        getIdToken: () => waitForToken ? token.promise : 'test-token',
    });
    sync.setAccount('account-a');
    await flush();
    await sync.pause();
    waitForToken = true;
    const deletion = sync.deleteRemote();
    sync.setAccount('account-b');
    token.resolve('account-b-token');
    assert.equal(await deletion, false);
    assert.equal(calls.some((call) => call.startsWith('delete:')), false);
});

test('failed remote deletion stays paused until the caller resumes normal sync', async (t) => {
    const {sync, calls, remote, foreground} = syncFixture(t, {deleteFails: true});
    sync.setAccount('account-a');
    await flush();
    await sync.pause();
    assert.equal(await sync.deleteRemote(), false);
    const afterDelete = calls.length;
    foreground();
    t.mock.timers.tick(60000);
    await flush();
    assert.equal(calls.length, afterDelete);
    sync.resume();
    await flush();
    assert.ok(calls.slice(afterDelete).includes('read:account-a'));
    assert.equal(remote.has('account-a'), true);
});

function diagnosticsRecorder() {
    const operations = [];
    return {operations, diagnostics: {
        start(operation) {
            const entry = {operation};
            operations.push(entry);
            return {
                finish(outcome, attributes) {
                    if (!entry.outcome) Object.assign(entry, {outcome, attributes});
                },
                fail(error, attributes) {
                    if (!entry.outcome) Object.assign(entry, {outcome: 'error', error, attributes});
                },
            };
        },
        event() {}, capture() {},
    }};
}

test('offline authentication keeps sync pending without issuing a false Firestore permission error', async t => {
    const {operations, diagnostics} = diagnosticsRecorder();
    const options = {tokenFailure: 'network', diagnostics};
    const {sync, calls, movies, remote} = syncFixture(t, options);
    sync.setAccount('account-a');
    await flush();
    assert.equal(sync.getStatus().failure, 'network');
    assert.equal(calls.length, 0);
    assert.equal(movies()[0].id, 123);
    assert.equal(operations.some(entry => entry.error), false);
    assert.equal(operations[0].outcome, 'unavailable');
    options.tokenFailure = null;
    t.mock.timers.tick(1000);
    await flush();
    assert.equal(sync.getStatus().state, 'synced');
    assert.ok(remote.has('account-a'));
});

test('a real Firestore denial remains reportable after a token denial recovers', async t => {
    const {operations, diagnostics} = diagnosticsRecorder();
    const options = {tokenFailure: 'denied', diagnostics, readFailure: 'denied'};
    const {sync} = syncFixture(t, options);
    sync.setAccount('account-a');
    await flush();
    assert.equal(sync.getStatus().failure, 'denied');
    assert.equal(operations.some(entry => entry.error), false);
    options.tokenFailure = null;
    t.mock.timers.tick(1000);
    await flush();
    const failures = operations.filter(entry => entry.error);
    assert.equal(failures.length, 1);
    assert.equal(failures[0].operation, 'sync.pull');
    assert.equal(failures[0].attributes.error_code, 'denied');
});

test('an offline deletion token does not delete remote data or escape as an unhandled rejection', async t => {
    const options = {};
    const {sync, remote} = syncFixture(t, options);
    sync.setAccount('account-a');
    await flush();
    await sync.pause();
    options.tokenFailure = 'network';
    assert.equal(await sync.deleteRemote(), false);
    assert.equal(sync.getStatus().failure, 'network');
    assert.ok(remote.has('account-a'));
});

test('a temporarily missing identity token waits for authentication without reporting a Firestore denial', async t => {
    const {operations, diagnostics} = diagnosticsRecorder();
    let token = null;
    const {sync, calls, movies} = syncFixture(t, {diagnostics, getIdToken: () => token});
    sync.setAccount('account-a');
    await flush();
    assert.equal(calls.length, 0);
    assert.equal(movies()[0].id, 123);
    assert.equal(sync.getStatus().failure, 'denied');
    assert.equal(operations.some(entry => entry.error), false);
    assert.equal(operations[0].outcome, 'unavailable');
    assert.equal(operations[0].attributes.stage, 'authentication');
    token = 'current-user-token';
    t.mock.timers.tick(1000);
    await flush();
    assert.equal(sync.getStatus().state, 'synced');
    assert.ok(calls.includes('read:account-a'));
});
