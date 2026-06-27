import assert from 'node:assert/strict';
import test from 'node:test';
import {NewMoviesCache} from './new-movies-cache.ts';
import {InMemoryKeyValueStore} from './storage/key-value-store.ts';

const newCache = () => new NewMoviesCache(new InMemoryKeyValueStore());

test('cached ids round-trip through the store', () => {
    const cache = newCache();
    assert.deepEqual([...cache.getCachedIds()], []);
    cache.setCachedIds([1, 2, 3]);
    assert.deepEqual([...cache.getCachedIds()].sort(), [1, 2, 3]);
});

test('corrupt cached payload degrades to empty set', () => {
    const store = new InMemoryKeyValueStore();
    store.set('cached-ids', 'not json');
    assert.deepEqual([...new NewMoviesCache(store).getCachedIds()], []);
});

test('last-run date round-trips and starts undefined', () => {
    const cache = newCache();
    assert.equal(cache.getLastRunDate(), undefined);
    cache.setLastRunDate('2026-06-27');
    assert.equal(cache.getLastRunDate(), '2026-06-27');
});
