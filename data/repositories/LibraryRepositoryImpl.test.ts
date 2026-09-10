import assert from 'node:assert/strict';
import test from 'node:test';
import {createRequire} from 'node:module';
const require = createRequire(import.meta.url);
const {loadTypeScript} = require('../../tests/helpers/load-typescript.cjs');
const {LibraryRepositoryImpl} = loadTypeScript('data/repositories/LibraryRepositoryImpl.ts');
const {emptyLibraryState, libraryCollectionContains, liveLibraryCollections} = loadTypeScript('domain/policies/libraryMerge.ts');

function fixture() {
    const values = new Map<string, string>();
    const store = {getString: (key: string) => values.get(key), set: (key: string, value: string) => {values.set(key, value);}, delete: (key: string) => {values.delete(key);}};
    return {values, store, repository: new LibraryRepositoryImpl(store, () => 100)};
}

test('watched state and collection membership persist independently of the saved movie list', () => {
    const {repository, store} = fixture();
    const id = repository.createCollection('  Friday   night ');
    repository.setWatched(42, true);
    repository.setCollectionMembership(42, id, true);
    const restored = new LibraryRepositoryImpl(store);
    assert.equal(restored.isWatched(42), true);
    assert.equal(libraryCollectionContains(restored.getState(), id, 42), true);
    assert.deepEqual(liveLibraryCollections(restored.getState()), [{id, name: 'Friday night'}]);
    restored.renameCollection(id, 'Weekend');
    assert.equal(libraryCollectionContains(restored.getState(), id, 42), true);
});

test('same-millisecond edits get strictly increasing timestamps and retain false tombstones', () => {
    const {repository} = fixture();
    repository.setWatched(42, true);
    const first = repository.getState().watched['42'].at;
    repository.setWatched(42, false);
    assert.ok(repository.getState().watched['42'].at > first);
    assert.equal(repository.getState().watched['42'].value, false);
    repository.setWatched(42, true);
    assert.equal(repository.isWatched(42), true);
});

test('removing a collection keeps its tombstone but excludes it from all memberships', () => {
    const {repository} = fixture();
    const id = repository.createCollection('A');
    repository.setCollectionMembership(42, id, true);
    repository.removeCollection(id);
    repository.renameCollection(id, 'B');
    assert.deepEqual(liveLibraryCollections(repository.getState()), []);
    assert.ok(repository.getState().collections[id].removedAt > 0);
    assert.equal(libraryCollectionContains(repository.getState(), id, 42), false);
});

test('clear leaves a syncable watermark and fresh edits remain possible', () => {
    const {repository} = fixture();
    repository.setWatched(42, true);
    repository.clear();
    assert.equal(repository.isWatched(42), false);
    assert.ok(repository.getState().clearedAt > 100);
    repository.setWatched(43, true);
    assert.equal(repository.isWatched(43), true);
});

test('invalid IDs, names and collection capacity fail without changing persisted state', () => {
    const {repository} = fixture();
    assert.throws(() => repository.setWatched(-1, true));
    assert.throws(() => repository.createCollection(' '));
    assert.throws(() => repository.createCollection('a'.repeat(61)));
    assert.deepEqual(repository.getState(), emptyLibraryState());
    for (let index = 0; index < 50; index += 1) repository.createCollection(`List ${index}`);
    assert.throws(() => repository.createCollection('Too many'));
    assert.equal(liveLibraryCollections(repository.getState()).length, 50);
});

test('failed persistence does not alter the observable snapshot', () => {
    const {repository, store} = fixture();
    let notified = 0;
    repository.subscribe(() => {notified += 1;});
    store.set = () => {throw new Error('disk full');};
    assert.throws(() => repository.setWatched(42, true), /disk full/);
    assert.equal(repository.isWatched(42), false);
    assert.equal(notified, 0);
});

test('remote state replacement clears account-local data and only publishes actual changes', () => {
    const {repository} = fixture();
    repository.setWatched(42, true);
    let notified = 0;
    const unsubscribe = repository.subscribe(() => {notified += 1;});
    repository.applyRemote(emptyLibraryState());
    repository.applyRemote(emptyLibraryState());
    assert.equal(repository.isWatched(42), false);
    assert.equal(notified, 1);
    unsubscribe();
    repository.setWatched(43, true);
    assert.equal(notified, 1);
});

test('unknown collection IDs cannot target inherited object properties', () => {
    const {repository} = fixture();
    repository.renameCollection('toString', 'Unexpected');
    repository.setCollectionMembership(42, 'valueOf', true);
    repository.removeCollection('constructor');
    assert.deepEqual(repository.getState(), emptyLibraryState());
});

test('pending account transitions reject every user mutation and stay blocked after restart', () => {
    const {repository, store} = fixture();
    const id = repository.createCollection('Original');
    repository.setMutationBlocked(true);
    const restarted = new LibraryRepositoryImpl(store);
    for (const operation of [
        () => restarted.setWatched(42, true),
        () => restarted.createCollection('New'),
        () => restarted.renameCollection(id, 'Changed'),
        () => restarted.removeCollection(id),
        () => restarted.setCollectionMembership(42, id, true),
        () => restarted.clear(),
    ]) assert.throws(operation, /account is still switching/);
    assert.equal(restarted.isWatched(42), false);
    assert.equal(liveLibraryCollections(restarted.getState())[0].name, 'Original');
    restarted.applyRemote(emptyLibraryState());
    restarted.setMutationBlocked(false);
    restarted.setWatched(42, true);
    assert.equal(restarted.isWatched(42), true);
});
