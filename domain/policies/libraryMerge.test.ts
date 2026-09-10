import assert from 'node:assert/strict';
import test from 'node:test';
import {emptyLibraryState, encodeLibraryState, libraryCollectionContains, libraryMovieWatched, liveLibraryCollections, mergeLibraryState, parseLibraryState} from './libraryMerge.ts';

const state = () => ({...emptyLibraryState(), collections: {favorites: {name: 'Favorites', updatedAt: 10, removedAt: 0}}});

test('independent watched and collection edits merge without replacing each other', () => {
    const a = {...state(), watched: {'1': {at: 20, value: true}}, memberships: {favorites: {'1': {at: 21, value: true}}}};
    const b = {...state(), watched: {'2': {at: 22, value: true}}, collections: {favorites: {name: 'Weekend', updatedAt: 23, removedAt: 0}}};
    const merged = mergeLibraryState(a, b);
    assert.equal(libraryMovieWatched(merged, 1), true);
    assert.equal(libraryMovieWatched(merged, 2), true);
    assert.equal(libraryCollectionContains(merged, 'favorites', 1), true);
    assert.deepEqual(liveLibraryCollections(merged), [{id: 'favorites', name: 'Weekend'}]);
    assert.equal(encodeLibraryState(merged), encodeLibraryState(mergeLibraryState(b, a)));
});

test('explicit unwatched and removed membership marks beat older offline copies', () => {
    const a = {...state(), watched: {'1': {at: 20, value: true}}, memberships: {favorites: {'1': {at: 20, value: true}}}};
    const b = {...state(), watched: {'1': {at: 21, value: false}}, memberships: {favorites: {'1': {at: 21, value: false}}}};
    const merged = mergeLibraryState(a, b);
    assert.equal(libraryMovieWatched(merged, 1), false);
    assert.equal(libraryCollectionContains(merged, 'favorites', 1), false);
    assert.deepEqual(mergeLibraryState(merged, a), merged);
});

test('equal timestamps consistently prefer false marks and a deterministic collection name', () => {
    const a = {...state(), watched: {'1': {at: 20, value: true}}};
    const b = {...state(), watched: {'1': {at: 20, value: false}}, collections: {favorites: {name: 'Weekend', updatedAt: 10, removedAt: 0}}};
    const merged = mergeLibraryState(a, b);
    assert.equal(libraryMovieWatched(merged, 1), false);
    assert.equal(encodeLibraryState(merged), encodeLibraryState(mergeLibraryState(b, a)));
});

test('deleting a collection wins over an offline rename or membership edit', () => {
    const a = {...state(), collections: {favorites: {name: 'Favorites', updatedAt: 10, removedAt: 20}}};
    const b = {...state(), collections: {favorites: {name: 'Renamed offline', updatedAt: 25, removedAt: 0}}, memberships: {favorites: {'1': {at: 30, value: true}}}};
    const merged = mergeLibraryState(a, b);
    assert.deepEqual(liveLibraryCollections(merged), []);
    assert.equal(libraryCollectionContains(merged, 'favorites', 1), false);
    assert.equal(merged.collections.favorites.removedAt, 20);
    assert.deepEqual(merged.memberships, {});
});

test('clear suppresses older data while later explicit watched updates survive', () => {
    const a = {...state(), watched: {'1': {at: 20, value: true}, '2': {at: 40, value: true}}};
    const b = {...emptyLibraryState(), clearedAt: 30};
    const merged = mergeLibraryState(a, b);
    assert.equal(libraryMovieWatched(merged, 1), false);
    assert.equal(libraryMovieWatched(merged, 2), true);
    assert.deepEqual(liveLibraryCollections(merged), []);
    assert.equal(merged.clearedAt, 30);
});

test('malformed keys, values and oversized names are rejected without prototype pollution', () => {
    const parsed = parseLibraryState('{"watched":{"-1":{"at":2,"value":true},"2":{"at":2,"value":"true"},"3":{"at":3,"value":true}},"collections":{"__proto__":{"name":"bad","updatedAt":4,"removedAt":0},"good":{"name":"  Weekend   picks  ","updatedAt":4,"removedAt":0},"long":{"name":"' + 'x'.repeat(61) + '","updatedAt":4}},"memberships":{"missing":{"1":{"at":5,"value":true}}}}');
    assert.deepEqual(Object.keys(parsed.watched), ['3']);
    assert.deepEqual(liveLibraryCollections(parsed), [{id: 'good', name: 'Weekend picks'}]);
    assert.deepEqual(parsed.memberships, {});
    assert.deepEqual(parseLibraryState('corrupt'), emptyLibraryState());
});

test('normalization caps hostile collections and marks with stable ordering', () => {
    const watched = Object.fromEntries(Array.from({length: 2100}, (_, index) => [String(index + 1), {at: index + 1, value: true}]));
    const parsed = parseLibraryState(JSON.stringify({...emptyLibraryState(), watched}));
    assert.equal(Object.keys(parsed.watched).length, 2000);
    assert.equal(parsed.watched['1'], undefined);
    assert.equal(parsed.watched['2100'].value, true);
    assert.equal(encodeLibraryState(parsed), encodeLibraryState(parseLibraryState(encodeLibraryState(parsed))));
});

test('collection IDs matching inherited properties keep their own membership records', () => {
    for (const id of ['toString', 'valueOf', 'hasOwnProperty', '__defineGetter__']) {
        const inherited = Object.getOwnPropertyDescriptor(Object.prototype, id)?.value;
        const before = Object.getOwnPropertyDescriptors(inherited);
        const parsed = parseLibraryState(JSON.stringify({
            collections: {[id]: {name: 'Weekend', updatedAt: 10, removedAt: 0}},
            memberships: {[id]: {'42': {at: 11, value: true}}},
        }));
        assert.equal(Object.hasOwn(parsed.memberships, id), true);
        assert.equal(libraryCollectionContains(parsed, id, 42), true);
        assert.deepEqual(Object.getOwnPropertyDescriptors(inherited), before);
        const merged = mergeLibraryState(emptyLibraryState(), parsed);
        assert.equal(libraryCollectionContains(merged, id, 42), true);
        assert.equal(encodeLibraryState(merged), encodeLibraryState(parsed));
        assert.deepEqual(Object.getOwnPropertyDescriptors(inherited), before);
    }
});
