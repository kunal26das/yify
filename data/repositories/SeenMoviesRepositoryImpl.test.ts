import assert from 'node:assert/strict';
import test from 'node:test';
import {SeenMoviesRepositoryImpl} from './SeenMoviesRepositoryImpl.ts';
import {SessionCache} from '../datasources/storage/SessionCache.ts';

const newCache = () => new SeenMoviesRepositoryImpl(new SessionCache());

test('seen ids round-trip through the store', () => {
    const cache = newCache();
    assert.deepEqual([...cache.getSeenIds()], []);
    cache.setSeenIds([1, 2, 3]);
    assert.deepEqual([...cache.getSeenIds()].sort(), [1, 2, 3]);
});

test('corrupt cached payload degrades to empty set', () => {
    const store = new SessionCache();
    store.set('cached-ids', 'not json');
    assert.deepEqual([...new SeenMoviesRepositoryImpl(store).getSeenIds()], []);
});

test('last-run date round-trips and starts undefined', () => {
    const cache = newCache();
    assert.equal(cache.getLastRunDate(), undefined);
    cache.setLastRunDate('2026-06-27');
    assert.equal(cache.getLastRunDate(), '2026-06-27');
});

test('query signature round-trips and starts undefined', () => {
    const cache = newCache();
    assert.equal(cache.getQuerySignature(), undefined);
    cache.setQuerySignature('q:2160p');
    assert.equal(cache.getQuerySignature(), 'q:2160p');
    cache.setQuerySignature('q:all');
    assert.equal(cache.getQuerySignature(), 'q:all');
});
