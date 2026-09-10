const assert = require('node:assert/strict');
const {test} = require('node:test');
const {loadTypeScript} = require('./helpers/load-typescript.cjs');

const flush = () => new Promise(setImmediate);
const {PreferencesRepositoryImpl} = loadTypeScript('data/repositories/PreferencesRepositoryImpl.ts');
const {LibraryRepositoryImpl} = loadTypeScript('data/repositories/LibraryRepositoryImpl.ts');
const {encodeLibraryState, emptyLibraryState} = loadTypeScript('domain/policies/libraryMerge.ts');

function memoryStore() {
    const values = new Map();
    return {getString: key => values.get(key), set: (key, value) => values.set(key, value), delete: key => values.delete(key)};
}

function fixture(t, options = {}) {
    if (!options.skipTimers) t.mock.timers.enable({apis: ['setTimeout', 'setInterval']});
    const remote = options.remote ?? new Map();
    const revisions = options.revisions ?? new Map();
    const patches = [];
    const libraryStore = options.libraryStore ?? memoryStore();
    const library = new LibraryRepositoryImpl(libraryStore, () => 1000);
    const store = options.store ?? memoryStore();
    const {AccountSyncImpl} = loadTypeScript('data/services/AccountSyncImpl.ts', {
        '../datasources/platform/ForegroundWatcher': {isForeground: () => true, watchForeground: () => () => {}},
        '../datasources/sync/FirestoreSyncDataSource': {
            MAX_WATCHLIST_CHARS: 500000, MAX_PREFERENCES_CHARS: 4000, MAX_HISTORY_CHARS: 150000, MAX_LIBRARY_CHARS: 300000,
            fetchSyncDocument: async uid => {
                await options.beforeRead?.(uid);
                return {ok: true, document: {...remote.get(uid)}, updateTime: remote.has(uid) ? String(revisions.get(uid) ?? 1) : undefined};
            },
            writeSyncDocument: async (uid, token, patch, precondition) => {
                await options.beforeWrite?.(uid, patch, precondition);
                const revision = remote.has(uid) ? String(revisions.get(uid) ?? 1) : undefined;
                if (precondition && (options.alwaysConflict || ('updateTime' in precondition ? precondition.updateTime !== revision : remote.has(uid)))) {
                    return {ok: false, conflict: true, failure: 'server', detail: 'document changed'};
                }
                patches.push({uid, patch});
                remote.set(uid, {...remote.get(uid), ...patch});
                revisions.set(uid, Number(revision ?? 0) + 1);
                return {ok: true};
            },
            deleteSyncDocument: async uid => {remote.delete(uid); return {ok: true};},
        },
    });
    let movies = [];
    let history = {entries: [], removed: {}, clearedAt: 0};
    const preferences = new PreferencesRepositoryImpl(memoryStore());
    const sync = new AccountSyncImpl({
        store, library, auth: {getIdToken: async () => 'test-token'},
        watchlist: {getAll: () => movies, applyRemote: value => {movies = value;}, subscribe: () => () => {}},
        watchHistory: {getState: () => history, applyRemote: value => {history = value;}, subscribe: () => () => {}},
        preferences,
    });
    sync.start();
    return {sync, library, libraryStore, store, remote, revisions, patches, preferences};
}

function remoteState(id, value, at) {
    return {library: encodeLibraryState({...emptyLibraryState(), watched: {[id]: {value, at}}})};
}

test('first account imports local explicit status and merges independent remote status', async t => {
    const {library, sync, remote} = fixture(t);
    library.setWatched(1, true);
    remote.set('a', remoteState(2, true, 500));
    sync.setAccount('a');
    await flush();
    assert.equal(library.isWatched(1), true);
    assert.equal(library.isWatched(2), true);
    assert.equal(JSON.parse(remote.get('a').library).watched['1'].value, true);
});

test('switching accounts immediately isolates library data and restores it when returning', async t => {
    const {library, sync, remote} = fixture(t);
    library.setWatched(1, true);
    sync.setAccount('a');
    await flush();
    remote.set('b', remoteState(2, true, 500));
    sync.setAccount('b');
    assert.equal(library.isWatched(1), false);
    await flush();
    assert.equal(library.isWatched(2), true);
    assert.equal(JSON.parse(remote.get('b').library).watched['1'], undefined);
    sync.setAccount('a');
    assert.equal(library.isWatched(1), true);
    assert.equal(library.isWatched(2), false);
    await flush();
    assert.equal(library.isWatched(1), true);
});

test('newer remote unwatched mark beats a local watched mark', async t => {
    const {library, sync, remote} = fixture(t);
    library.setWatched(1, true);
    remote.set('a', remoteState(1, false, 1500));
    sync.setAccount('a');
    await flush();
    assert.equal(library.isWatched(1), false);
    assert.equal(library.getState().watched['1'].at, 1500);
});

test('library upload merges the latest remote fields and keeps watched metadata outside watchlist', async t => {
    const {library, sync, remote, patches} = fixture(t);
    sync.setAccount('a');
    await flush();
    library.setWatched(1, true);
    remote.set('a', {...remote.get('a'), ...remoteState(2, true, 500)});
    t.mock.timers.tick(1500);
    await flush();
    const payload = JSON.parse(remote.get('a').library);
    assert.equal(payload.watched['1'].value, true);
    assert.equal(payload.watched['2'].value, true);
    assert.equal(patches.at(-1).patch.watchlist, undefined);
    assert.equal(sync.getStatus().pendingChanges, false);
});

test('an older client watchlist-only patch cannot erase watched metadata or collections', async t => {
    const {library, sync, remote} = fixture(t);
    const id = library.createCollection('Weekend');
    library.setCollectionMembership(1, id, true);
    sync.setAccount('a');
    await flush();
    const saved = remote.get('a').library;
    remote.set('a', {...remote.get('a'), watchlist: '{"items":[],"marks":{}}', watchlistUpdatedAt: 4000});
    sync.syncNow();
    await flush();
    assert.equal(remote.get('a').library, saved);
    assert.equal(library.getState().collections[id].name, 'Weekend');
});

test('local changes during an upload remain pending and are included in the next upload', async t => {
    let block = false;
    let finish;
    const wait = new Promise(resolve => {finish = resolve;});
    const {library, sync, remote} = fixture(t, {beforeWrite: () => block ? wait : undefined});
    sync.setAccount('a');
    await flush();
    block = true;
    library.setWatched(1, true);
    t.mock.timers.tick(1500);
    await flush();
    library.setWatched(2, true);
    finish();
    await flush();
    assert.equal(sync.getStatus().pendingChanges, true);
    t.mock.timers.tick(1500);
    await flush();
    assert.equal(JSON.parse(remote.get('a').library).watched['2'].value, true);
    assert.equal(sync.getStatus().pendingChanges, false);
});

test('account deletion leaves metadata attributed to the old account instead of importing it into the next', async t => {
    const {library, sync, remote} = fixture(t);
    library.setWatched(1, true);
    sync.setAccount('a');
    await flush();
    await sync.pause();
    assert.equal(await sync.deleteRemote(), true);
    sync.setAccount('b');
    sync.resume();
    await flush();
    assert.equal(library.isWatched(1), false);
    assert.equal(remote.has('a'), false);
    assert.equal(remote.get('b')?.library, undefined);
});

test('Firestore update masks preserve fields not included by older clients', async t => {
    const calls = [];
    t.mock.method(globalThis, 'fetch', async (url, options) => {
        calls.push({url, body: JSON.parse(options.body)});
        return {ok: true};
    });
    const {writeSyncDocument} = loadTypeScript('data/datasources/sync/FirestoreSyncDataSource.ts');
    await writeSyncDocument('a', 'token', {library: '{}', libraryUpdatedAt: 12});
    assert.match(calls[0].url, /updateMask.fieldPaths=library(&|$)/);
    assert.match(calls[0].url, /updateMask.fieldPaths=libraryUpdatedAt/);
    assert.equal(calls[0].body.fields.library.stringValue, '{}');
    await writeSyncDocument('a', 'token', {watchlist: '[]'});
    assert.doesNotMatch(calls[1].url, /library/);
    assert.deepEqual(Object.keys(calls[1].body.fields), ['watchlist']);
});

for (const existing of [true, false]) {
    test(`concurrent devices preserve both library edits when ${existing ? 'updating' : 'creating'} the remote document`, async t => {
        const remote = new Map();
        const revisions = new Map();
        let waiting = 0;
        let release;
        const barrier = new Promise(resolve => {release = resolve;});
        const beforeWrite = async (uid, patch) => {
            if (!patch.library || waiting >= 2) return;
            waiting += 1;
            if (waiting === 2) release();
            await barrier;
        };
        const a = fixture(t, {remote, revisions, beforeWrite});
        const b = fixture(t, {remote, revisions, beforeWrite, skipTimers: true});
        if (existing) {
            a.sync.setAccount('same');
            b.sync.setAccount('same');
            await flush();
        }
        a.library.setWatched(1, true);
        b.library.setWatched(2, true);
        if (existing) t.mock.timers.tick(1500);
        else {
            a.sync.setAccount('same');
            b.sync.setAccount('same');
        }
        await flush();
        const watched = JSON.parse(remote.get('same').library).watched;
        assert.equal(watched['1'].value, true);
        assert.equal(watched['2'].value, true);
        assert.equal(a.sync.getStatus().state, 'synced');
        assert.equal(b.sync.getStatus().state, 'synced');
        assert.equal(waiting, 2);
    });
}

test('repeated conditional-write conflicts stop after a bounded attempt count and remain pending', async t => {
    let attempts = 0;
    const {library, sync, remote} = fixture(t, {alwaysConflict: true, beforeWrite: (uid, patch) => {if (patch.library) attempts += 1;}});
    sync.setAccount('a');
    await flush();
    library.setWatched(1, true);
    t.mock.timers.tick(1500);
    await flush();
    assert.equal(attempts, 3);
    assert.equal(sync.getStatus().state, 'error');
    assert.equal(sync.getStatus().pendingChanges, true);
    assert.equal(remote.get('a').library, undefined);
});

test('an older client omitting country preference is repaired in cloud after a newer preferences update', async t => {
    const {preferences, sync, remote} = fixture(t);
    preferences.setWatchRegion('IN');
    sync.setAccount('a');
    await flush();
    const older = {...JSON.parse(remote.get('a').preferences), theme: 'light'};
    delete older.watchRegion;
    remote.set('a', {...remote.get('a'), preferences: JSON.stringify(older), preferencesUpdatedAt: Date.now() + 1000});
    sync.syncNow();
    await flush();
    assert.equal(preferences.getPreferences().theme, 'light');
    assert.equal(preferences.getPreferences().watchRegion, 'IN');
    assert.equal(JSON.parse(remote.get('a').preferences).watchRegion, 'IN');
    assert.equal(sync.getStatus().pendingChanges, false);
});

test('a failed account replacement never uploads the previous account library after storage recovers', async t => {
    const {library, libraryStore, sync, store, remote} = fixture(t);
    library.setWatched(1, true);
    sync.setAccount('a');
    await flush();
    const write = libraryStore.set;
    libraryStore.set = () => {throw new Error('disk full');};
    sync.setAccount('b');
    await flush();
    assert.equal(store.getString('libraryUid'), 'a');
    assert.equal(sync.getStatus().state, 'error');
    assert.equal(remote.has('b'), false);
    libraryStore.set = write;
    sync.syncNow();
    await flush();
    assert.equal(library.isWatched(1), false);
    assert.equal(store.getString('libraryUid'), 'b');
    assert.equal(store.getString('libraryTransition'), undefined);
    assert.equal(remote.get('b')?.library, undefined);
    sync.setAccount('a');
    await flush();
    assert.equal(library.isWatched(1), true);
});

test('restart after shared library replacement but before owner commit recovers through the journal', async t => {
    const remote = new Map();
    const a = fixture(t, {remote});
    a.library.setWatched(1, true);
    a.sync.setAccount('a');
    await flush();
    remote.set('b', remoteState(2, true, 500));
    const write = a.store.set;
    a.store.set = (key, value) => {
        if (key === 'libraryUid' && value === 'b') throw new Error('disk full');
        write(key, value);
    };
    a.sync.setAccount('b');
    await flush();
    assert.equal(a.store.getString('libraryUid'), 'a');
    assert.ok(a.store.getString('libraryTransition'));
    assert.equal(a.library.isWatched(1), false);
    await a.sync.pause();
    a.store.set = write;
    const restarted = fixture(t, {remote, store: a.store, libraryStore: a.libraryStore, skipTimers: true});
    restarted.sync.setAccount('a');
    await flush();
    assert.equal(restarted.library.isWatched(1), true);
    assert.equal(restarted.library.isWatched(2), false);
    assert.equal(restarted.store.getString('libraryTransition'), undefined);
    assert.equal(JSON.parse(remote.get('a').library).watched['2'], undefined);
});

test('Firestore transports read revisions and conditional update/create guards without changing masks', async t => {
    const calls = [];
    let response = {ok: true, json: async () => ({fields: {library: {stringValue: '{}'}}, updateTime: '2026-09-11T12:00:00.123456Z'})};
    t.mock.method(globalThis, 'fetch', async (url, options) => {calls.push({url, options}); return response;});
    const {fetchSyncDocument, writeSyncDocument} = loadTypeScript('data/datasources/sync/FirestoreSyncDataSource.ts');
    const read = await fetchSyncDocument('a', 'token');
    assert.equal(read.updateTime, '2026-09-11T12:00:00.123456Z');
    await writeSyncDocument('a', 'token', {library: '{}'}, {updateTime: read.updateTime});
    assert.match(calls.at(-1).url, /documents:commit$/);
    assert.equal(calls.at(-1).options.method, 'POST');
    assert.equal(JSON.parse(calls.at(-1).options.body).writes[0].currentDocument.updateTime, read.updateTime);
    assert.deepEqual(JSON.parse(calls.at(-1).options.body).writes[0].updateMask.fieldPaths, ['library']);
    await writeSyncDocument('a', 'token', {library: '{}'}, {exists: false});
    assert.equal(JSON.parse(calls.at(-1).options.body).writes[0].currentDocument.exists, false);
    response = {ok: false, status: 400, json: async () => ({error: {status: 'FAILED_PRECONDITION', message: 'revision changed'}})};
    const conflict = await writeSyncDocument('a', 'token', {library: '{}'}, {updateTime: read.updateTime});
    assert.equal(conflict.conflict, true);
    assert.equal(conflict.failure, 'server');
    response = {ok: false, status: 403, json: async () => ({error: {status: 'PERMISSION_DENIED'}})};
    const denied = await writeSyncDocument('a', 'token', {library: '{}'}, {exists: false});
    assert.equal(denied.conflict, undefined);
    assert.equal(denied.failure, 'denied');
});

test('edits cannot be acknowledged then discarded while the target owner commit is unresolved', async t => {
    const {library, libraryStore, sync, store, remote} = fixture(t);
    library.setWatched(1, true);
    sync.setAccount('a');
    await flush();
    const write = store.set;
    store.set = (key, value) => {
        if (key === 'libraryUid' && value === 'b') throw new Error('disk full');
        write(key, value);
    };
    sync.setAccount('b');
    await flush();
    assert.ok(store.getString('libraryTransition'));
    assert.equal(library.isWatched(1), false);
    assert.throws(() => library.setWatched(2, true), /account is still switching/);
    const restarted = new LibraryRepositoryImpl(libraryStore);
    assert.throws(() => restarted.setWatched(2, true), /account is still switching/);
    assert.equal(libraryStore.getString('mutationBlocked'), 'true');
    store.set = write;
    sync.syncNow();
    await flush();
    assert.equal(store.getString('libraryTransition'), undefined);
    assert.equal(libraryStore.getString('mutationBlocked'), undefined);
    library.setWatched(2, true);
    t.mock.timers.tick(1500);
    await flush();
    assert.equal(JSON.parse(remote.get('b').library).watched['2'].value, true);
    assert.equal(JSON.parse(remote.get('b').library).watched['1'], undefined);
});

test('signing out during a failed transition recovers anonymously and keeps later edits with the right account', async t => {
    const {library, sync, store, remote} = fixture(t);
    library.setWatched(1, true);
    sync.setAccount('a');
    await flush();
    const write = store.set;
    store.set = (key, value) => {
        if (key === 'libraryUid' && value === 'b') throw new Error('disk full');
        write(key, value);
    };
    sync.setAccount('b');
    await flush();
    sync.setAccount(null);
    assert.throws(() => library.setWatched(2, true), /account is still switching/);
    assert.equal(sync.getStatus().state, 'error');
    store.set = write;
    t.mock.timers.tick(1000);
    await flush();
    assert.equal(store.getString('libraryTransition'), undefined);
    assert.equal(sync.getStatus().state, 'idle');
    library.setWatched(2, true);
    assert.equal(library.isWatched(2), true);
    assert.equal(remote.has('b'), false);
    sync.setAccount('a');
    await flush();
    assert.equal(library.isWatched(1), true);
    assert.equal(library.isWatched(2), false);
    sync.setAccount('b');
    await flush();
    assert.equal(library.isWatched(2), true);
    assert.equal(JSON.parse(remote.get('b').library).watched['2'].value, true);
    assert.equal(JSON.parse(remote.get('b').library).watched['1'], undefined);
});

for (const storageFailsAtRestart of [false, true]) {
    test(`signed-out startup recovers a pending library transition without authentication${storageFailsAtRestart ? ' after storage recovers' : ''}`, async t => {
        const original = fixture(t);
        original.library.setWatched(1, true);
        original.sync.setAccount('a');
        await flush();
        const write = original.store.set;
        original.store.set = (key, value) => {
            if (key === 'libraryUid' && value === 'b') throw new Error('disk full');
            write(key, value);
        };
        original.sync.setAccount('b');
        await flush();
        await original.sync.pause();
        if (!storageFailsAtRestart) original.store.set = write;
        let reads = 0;
        const restarted = fixture(t, {
            remote: original.remote, store: original.store, libraryStore: original.libraryStore,
            skipTimers: true, beforeRead: () => {reads += 1;},
        });
        if (storageFailsAtRestart) {
            assert.equal(restarted.sync.getStatus().state, 'error');
            assert.throws(() => restarted.library.setWatched(2, true), /account is still switching/);
            restarted.sync.setAccount(null);
            assert.equal(restarted.sync.getStatus().state, 'error');
            original.store.set = write;
            t.mock.timers.tick(1000);
            await flush();
        }
        assert.equal(restarted.sync.getStatus().state, 'idle');
        assert.equal(restarted.store.getString('libraryUid'), 'b');
        assert.equal(restarted.store.getString('libraryTransition'), undefined);
        assert.equal(restarted.libraryStore.getString('mutationBlocked'), undefined);
        assert.equal(restarted.library.isWatched(1), false);
        restarted.library.setWatched(2, true);
        assert.equal(restarted.library.isWatched(2), true);
        t.mock.timers.tick(30000);
        await flush();
        assert.equal(reads, 0);
        assert.deepEqual(restarted.patches, []);
        assert.equal(original.remote.has('b'), false);
        restarted.sync.setAccount('a');
        await flush();
        assert.equal(restarted.library.isWatched(1), true);
        assert.equal(restarted.library.isWatched(2), false);
        restarted.sync.setAccount('b');
        await flush();
        assert.equal(restarted.library.isWatched(2), true);
        assert.equal(JSON.parse(original.remote.get('b').library).watched['1'], undefined);
    });
}
