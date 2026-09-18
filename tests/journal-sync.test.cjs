const assert = require('node:assert/strict');
const {test} = require('node:test');
const {loadTypeScript} = require('./helpers/load-typescript.cjs');
const policy = loadTypeScript('domain/policies/journal.ts');
const {JournalRepositoryImpl} = loadTypeScript('data/repositories/JournalRepositoryImpl.ts', {
    '../datasources/platform/ForegroundWatcher': {isForeground: () => true, watchForeground: () => () => {}},
});
const movie = {id: 1, title: 'Private movie', year: 2024, runtimeMinutes: 90, genres: ['Drama'], posterUrl: null};
const input = (note = 'Private note') => ({movie, watchedOn: '2026-09-19', rating: 7, note});
const flush = async () => {for (let i = 0; i < 8; i += 1) await new Promise(setImmediate);};
function deferred() {let resolve; const promise = new Promise(done => {resolve = done;}); return {promise, resolve};}

function fixture(t, options = {}) {
    t.mock.timers.enable({apis: ['setTimeout', 'setInterval']});
    let uid = options.uid === undefined ? 'alice' : options.uid;
    let online = options.online ?? true;
    const values = options.values ?? new Map();
    const remote = options.remote ?? new Map();
    const calls = [];
    const listeners = new Set();
    let reconnect;
    let version = 0;
    const auth = {getSession: () => ({ready: true, account: uid ? {uid} : null}),
        subscribe: listener => {listeners.add(listener); return () => listeners.delete(listener);},
        getIdToken: async () => {if (options.beforeToken) await options.beforeToken(); return `token-${uid}`;}};
    const store = {getString: key => values.get(key), set: (key, value) => {if (options.storageFails) throw Error('disk full'); values.set(key, value);},
        delete: key => {if (options.storageFails) throw Error('disk full'); values.delete(key);}};
    const fetch = async (url, init) => {
        const token = init.headers.Authorization;
        let account = decodeURIComponent(url.split('/journals/')[1] ?? '');
        if (url.endsWith(':commit')) {
            const write = JSON.parse(init.body).writes[0];
            account = write.update.name.split('/journals/')[1];
            const deleting = write.update.fields.deleting?.booleanValue === true;
            calls.push(deleting ? `delete:${account}` : `write-start:${account}`);
            assert.equal(token, `Bearer token-${account}`);
            await options.beforeWrite?.(account);
            if (deleting && options.deleteFails) return new Response('{}', {status: 503});
            if (options.writeFails) throw Error('offline');
            if (options.conflictOnce) {options.conflictOnce = false; remote.set(account, options.conflictRemote);}
            const current = remote.get(account);
            if (current?.deleting) return new Response('{}', {status: 403});
            if (write.currentDocument.exists === false ? !!current : current?.updateTime !== write.currentDocument.updateTime) {
                return new Response(JSON.stringify({error: {status: 'FAILED_PRECONDITION'}}), {status: 400});
            }
            remote.set(account, {payload: write.update.fields.payload.stringValue, updateTime: `v${++version}`, deleting});
            calls.push(`write-end:${account}`);
            return new Response('{}');
        }
        assert.equal(token, `Bearer token-${account}`);
        if (init.method === 'DELETE') {
            calls.push(`delete:${account}`);
            if (options.deleteFails) return new Response('{}', {status: 503});
            remote.delete(account);
            return new Response('{}');
        }
        calls.push(`read:${account}`);
        const captured = remote.get(account);
        await options.beforeRead?.(account);
        if (options.readFails) throw Error('offline');
        if (!captured) return new Response('{}', {status: 404});
        return new Response(JSON.stringify({fields: {payload: {stringValue: captured.payload}, deleting: {booleanValue: captured.deleting === true}}, updateTime: captured.updateTime}));
    };
    const build = () => new JournalRepositoryImpl({auth, store, network: {isOnline: () => online,
        subscribe: listener => {reconnect = listener; return () => {};}}, fetch, now: () => new Date(2026, 8, 19, 12).getTime()});
    const repository = build();
    repository.start();
    return {repository, remote, values, calls, options, build,
        switchAccount(next) {uid = next; listeners.forEach(listener => listener());},
        online(next) {online = next; reconnect?.();}};
}

test('journal requires sign-in, never imports guest data and clears previous-account notes immediately', async t => {
    const f = fixture(t, {uid: null});
    assert.throws(() => f.repository.save(input()), /Sign in/);
    f.switchAccount('alice');
    await flush();
    f.repository.save(input('Alice only'));
    const snapshots = [];
    f.repository.subscribe(() => snapshots.push(f.repository.getSnapshot()));
    f.switchAccount('bob');
    assert.equal(snapshots[0].entries.length, 0);
    assert.equal(f.repository.getSnapshot().entries.length, 0);
    f.repository.save(input('Bob only'));
    f.switchAccount('alice');
    assert.equal(f.repository.getSnapshot().entries[0].note, 'Alice only');
    f.switchAccount(null);
    assert.equal(f.repository.getSnapshot().entries.length, 0);
});

test('offline journal edits survive restart and upload after reconnect without rewriting equal records', async t => {
    const f = fixture(t, {online: false});
    const id = f.repository.save(input());
    const restored = f.build();
    restored.start();
    assert.equal(restored.getSnapshot().entries[0].id, id);
    f.online(true);
    await flush();
    assert.equal(policy.parseJournalData(f.remote.get('alice').payload).entries[id].note, 'Private note');
    const count = f.calls.filter(call => call.startsWith('write-end')).length;
    restored.retrySync();
    await flush();
    assert.equal(f.calls.filter(call => call.startsWith('write-end')).length, count);
});

test('two offline clients sharing a cache preserve both notes and use newer revisions when editing', t => {
    const f = fixture(t, {online: false});
    const second = f.build();
    second.start();
    const id = f.repository.save(input('First tab'));
    second.save(input('Second tab'));
    second.save({...input('Edited from second tab'), id});
    const persisted = policy.parseJournalData(f.values.get('account:alice'));
    assert.equal(Object.keys(persisted.entries).length, 2);
    assert.equal(persisted.entries[id].note, 'Edited from second tab');
    f.repository.remove(id);
    assert.throws(() => second.save({...input('Stale edit'), id}), /removed/);
    assert.equal(policy.journalEntries(policy.parseJournalData(f.values.get('account:alice'))).length, 1);
});

test('a delayed old-account read cannot reveal its notes in the new account', async t => {
    const delayed = deferred();
    const existing = {id: 'old', ...input('Alice remote secret'), updatedAt: 1, deletedAt: 0};
    const remote = new Map([['alice', {payload: policy.encodeJournalData({entries: {old: existing}, clearedAt: 0}), updateTime: 'v0'}]]);
    const f = fixture(t, {remote, beforeRead: uid => uid === 'alice' ? delayed.promise : undefined});
    await flush();
    f.switchAccount('bob');
    delayed.resolve();
    await flush();
    t.mock.timers.tick(0);
    await flush();
    assert.deepEqual(f.repository.getSnapshot().entries, []);
    assert.equal(f.values.has('account:bob'), false);
    assert.ok(f.calls.includes('read:bob'));
});

test('compare-and-swap conflicts merge another device entry before retrying', async t => {
    const remoteEntry = {id: 'remote-entry', ...input('Other device'), updatedAt: 1, deletedAt: 0};
    const options = {online: false, conflictOnce: true,
        conflictRemote: {payload: policy.encodeJournalData({entries: {'remote-entry': remoteEntry}, clearedAt: 0}), updateTime: 'remote-version'}};
    const f = fixture(t, options);
    f.repository.save(input('This device'));
    f.online(true);
    await flush();
    const entries = policy.journalEntries(policy.parseJournalData(f.remote.get('alice').payload));
    assert.equal(entries.length, 2);
    assert.deepEqual(entries.map(entry => entry.note).sort(), ['Other device', 'This device']);
});

test('edits made while upload is in flight are uploaded in the following pass', async t => {
    const delayed = deferred();
    const options = {online: false, beforeWrite: () => delayed.promise};
    const f = fixture(t, options);
    const id = f.repository.save(input('First'));
    f.online(true);
    await flush();
    f.repository.save({...input('Second'), id});
    options.beforeWrite = undefined;
    delayed.resolve();
    await flush();
    t.mock.timers.tick(0);
    await flush();
    assert.equal(policy.parseJournalData(f.remote.get('alice').payload).entries[id].note, 'Second');
});

test('removal syncs a tombstone and scrubs private notes and ratings', async t => {
    const f = fixture(t, {online: false});
    const id = f.repository.save(input());
    f.repository.remove(id);
    assert.equal(f.repository.getSnapshot().entries.length, 0);
    const tombstone = policy.parseJournalData(f.values.get('account:alice')).entries[id];
    assert.equal(tombstone.note, '');
    assert.equal(tombstone.rating, null);
    assert.equal(tombstone.movie.title, 'Removed entry');
    assert.ok(tombstone.deletedAt > 0);
    f.online(true);
    await flush();
    assert.equal(policy.journalEntries(policy.parseJournalData(f.remote.get('alice').payload)).length, 0);
});

test('storage failure leaves the visible journal unchanged and malformed local data blocks writes', async t => {
    const f = fixture(t, {online: false});
    f.options.storageFails = true;
    assert.throws(() => f.repository.save(input()), /saved on this device/);
    assert.equal(f.repository.getSnapshot().entries.length, 0);
    assert.match(f.repository.getSnapshot().error, /storage/);
    f.options.storageFails = false;
    f.values.set('account:bob', '{broken');
    f.switchAccount('bob');
    assert.equal(f.repository.getSnapshot().ready, false);
    assert.throws(() => f.repository.save(input()), /loading/);
    assert.equal(f.values.get('account:bob'), '{broken');
});

test('pause drains an active write, deletion removes local data and stays paused against resurrection', async t => {
    const delayed = deferred();
    const f = fixture(t, {online: false, beforeWrite: () => delayed.promise});
    f.repository.save(input());
    f.online(true);
    await flush();
    let drained = false;
    const paused = f.repository.pause().then(() => {drained = true;});
    await flush();
    assert.equal(drained, false);
    delayed.resolve();
    await paused;
    assert.equal(await f.repository.deleteRemote(), true);
    assert.equal(f.remote.get('alice').deleting, true);
    assert.deepEqual(policy.parseJournalData(f.remote.get('alice').payload), policy.emptyJournalData());
    assert.equal(f.values.has('account:alice'), false);
    const count = f.calls.length;
    f.repository.retrySync();
    t.mock.timers.tick(60000);
    await flush();
    assert.equal(f.calls.length, count);
    assert.throws(() => f.repository.save(input()), /removed/);
});

test('account deletion marker prevents another device from resurrecting old private notes', async t => {
    const f = fixture(t, {online: false});
    f.repository.save(input('Must stay deleted'));
    const second = f.build();
    second.start();
    f.online(true);
    await flush();
    assert.equal(await f.repository.deleteRemote(), true);
    second.retrySync();
    await flush();
    assert.equal(f.remote.get('alice').deleting, true);
    assert.deepEqual(policy.parseJournalData(f.remote.get('alice').payload), policy.emptyJournalData());
    assert.deepEqual(second.getSnapshot().entries, []);
    assert.throws(() => second.save(input('Cannot recreate')), /removed/);
    assert.equal(f.values.has('account:alice'), false);
    const restarted = f.build();
    restarted.start();
    assert.equal(restarted.getSnapshot().ready, false);
    assert.throws(() => restarted.save(input('Cannot recreate offline')), /removed/);
});

test('account deletion can erase malformed remote notes without trying to merge them', async t => {
    const remote = new Map([['alice', {payload: '{broken', updateTime: 'v0'}]]);
    const f = fixture(t, {remote});
    await flush();
    assert.equal(await f.repository.deleteRemote(), true);
    assert.equal(f.remote.get('alice').deleting, true);
    assert.deepEqual(policy.parseJournalData(f.remote.get('alice').payload), policy.emptyJournalData());
});

test('failed deletion preserves local records and account changes during token fetch cancel deletion', async t => {
    const options = {online: false, deleteFails: true};
    const f = fixture(t, options);
    f.repository.save(input());
    assert.equal(await f.repository.deleteRemote(), false);
    assert.ok(f.values.has('account:alice'));
    assert.match(f.repository.getSnapshot().error, /deleted/);
    const token = deferred();
    options.beforeToken = () => token.promise;
    const deletion = f.repository.deleteRemote();
    await flush();
    f.switchAccount('bob');
    token.resolve();
    assert.equal(await deletion, false);
    assert.equal(f.calls.filter(call => call === 'delete:bob').length, 0);
});

test('unreadable remote records are never replaced with empty or local data', async t => {
    const remote = new Map([['alice', {payload: '{broken', updateTime: 'v0'}]]);
    const f = fixture(t, {remote});
    await flush();
    f.repository.save(input());
    f.repository.retrySync();
    await flush();
    assert.equal(f.remote.get('alice').payload, '{broken');
    assert.equal(f.calls.some(call => call.startsWith('write-start')), false);
    assert.ok(f.repository.getSnapshot().error);
});
