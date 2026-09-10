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
    const {AccountSyncImpl} = loadTypeScript('data/services/AccountSyncImpl.ts', {
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
        auth: {getIdToken: async () => options.getIdToken ? options.getIdToken() : 'test-token'},
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
