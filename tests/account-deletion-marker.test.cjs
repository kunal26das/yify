const assert = require('node:assert/strict');
const {test} = require('node:test');
const {loadTypeScript} = require('./helpers/load-typescript.cjs');

for (const operation of ['fetchSyncDocument', 'writeSyncDocument']) {
    test(`${operation} recognizes a verified deletion marker without returning saved account content`, async t => {
        const calls = [];
        t.mock.method(globalThis, 'fetch', async (url, options) => {
            calls.push({url, options});
            return url.includes('/journals/')
                ? {ok: true, status: 200, json: async () => ({fields: {deleting: {booleanValue: true}}})}
                : {ok: false, status: 403, json: async () => ({error: {message: 'Permission denied'}})};
        });
        const source = loadTypeScript('data/datasources/sync/FirestoreSyncDataSource.ts');
        const result = await source[operation]('account-a', 'token', {watchlist: '[]'});
        assert.equal(result.ok, false);
        assert.equal(result.failure, 'deleted');
        assert.equal(result.document, undefined);
        assert.equal(calls.length, 2);
        assert.match(calls[1].url, /journals\/account-a\?mask.fieldPaths=deleting$/);
        assert.equal(calls[1].options.headers.Authorization, 'Bearer token');
        assert.equal(calls[1].options.cache, 'no-store');
    });
}

for (const marker of [false, 'true', undefined, 'unavailable']) {
    test(`a ${String(marker)} marker does not erase local data on an ordinary permission error`, async t => {
        t.mock.method(globalThis, 'fetch', async url => {
            if (!url.includes('/journals/')) return {ok: false, status: 403, json: async () => ({})};
            if (marker === 'unavailable') throw new Error('Offline');
            return {ok: true, status: 200, json: async () => ({fields: {deleting: {booleanValue: marker}}})};
        });
        const {fetchSyncDocument} = loadTypeScript('data/datasources/sync/FirestoreSyncDataSource.ts');
        const result = await fetchSyncDocument('account-a', 'token');
        assert.equal(result.failure, 'denied');
    });
}

test('the owner can retry removing the account document after the deletion marker was created', async t => {
    const calls = [];
    t.mock.method(globalThis, 'fetch', async (url, options) => {
        calls.push({url, options});
        return {ok: true, status: 200};
    });
    const {deleteSyncDocument} = loadTypeScript('data/datasources/sync/FirestoreSyncDataSource.ts');
    assert.equal((await deleteSyncDocument('account-a', 'token')).ok, true);
    assert.equal(calls.length, 1);
    assert.equal(calls[0].options.method, 'DELETE');
});
