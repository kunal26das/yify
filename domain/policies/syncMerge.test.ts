import assert from 'node:assert/strict';
import test from 'node:test';

import {
    chooseSyncMode,
    encodeWatchlistState,
    fitWatchlistPayload,
    markChanges,
    mergeWatchlistState,
    parseWatchlistState,
    payloadWithinBudget,
    pruneMarks,
    resolveSection,
    sameWatchlistState,
    type WatchlistMarks,
    type WatchlistState,
} from './syncMerge.ts';

interface Entry {
    id: number;
    title?: string;
}

function state(items: Entry[], marks: WatchlistMarks = {}): WatchlistState<Entry> {
    return {items, marks};
}

function ids(next: WatchlistState<Entry>): number[] {
    return next.items.map((item) => item.id);
}

test('a device that has never linked unions its local list into the account', () => {
    assert.equal(chooseSyncMode(undefined, 'uid-a'), 'union');
    assert.equal(chooseSyncMode('', 'uid-a'), 'union');
});

test('a device already linked to the same account compares timestamps', () => {
    assert.equal(chooseSyncMode('uid-a', 'uid-a'), 'compare');
});

test('switching accounts takes the new account wholesale instead of merging', () => {
    assert.equal(chooseSyncMode('uid-a', 'uid-b'), 'remote-wins');
});

test('remote-wins ignores timestamps entirely', () => {
    assert.equal(resolveSection('remote-wins', 0, 9999), 'apply-remote');
});

test('newer side wins when comparing', () => {
    assert.equal(resolveSection('compare', 20, 10), 'apply-remote');
    assert.equal(resolveSection('compare', 10, 20), 'push-local');
    assert.equal(resolveSection('compare', 10, 10), 'in-sync');
});

test('parseWatchlistState survives absent, malformed and non-object payloads', () => {
    assert.deepEqual(parseWatchlistState(undefined), {items: [], marks: {}});
    assert.deepEqual(parseWatchlistState(''), {items: [], marks: {}});
    assert.deepEqual(parseWatchlistState('not json'), {items: [], marks: {}});
    assert.deepEqual(parseWatchlistState('42'), {items: [], marks: {}});
});

test('parseWatchlistState reads a bare array as a legacy unmarked payload', () => {
    const raw = JSON.stringify([{id: 1}, {id: '2'}, null, {title: 'x'}, {id: 3}]);
    assert.deepEqual(parseWatchlistState<Entry>(raw), {items: [{id: 1}, {id: 3}], marks: {}});
});

test('parseWatchlistState round-trips an encoded state', () => {
    const original = state([{id: 7}], {'7': {at: 100, deleted: false}});
    assert.deepEqual(parseWatchlistState<Entry>(encodeWatchlistState(original)), original);
});

test('parseWatchlistState drops marks that carry no usable timestamp', () => {
    const raw = JSON.stringify({
        version: 2,
        items: [],
        marks: {'1': {at: 5, deleted: true}, '2': {at: 'nope'}, '3': null},
    });
    assert.deepEqual(parseWatchlistState(raw).marks, {'1': {at: 5, deleted: true}});
});

test('markChanges stamps additions and removals against the previous ids', () => {
    const marks = markChanges({}, [1, 2], [2, 3], 500);
    assert.deepEqual(marks, {
        '3': {at: 500, deleted: false},
        '1': {at: 500, deleted: true},
    });
});

test('markChanges leaves untouched ids alone', () => {
    const existing: WatchlistMarks = {'1': {at: 10, deleted: false}};
    assert.deepEqual(markChanges(existing, [1], [1], 900), existing);
});

test('a remote addition arrives and a remote removal is honoured', () => {
    const local = state([{id: 1}], {'1': {at: 100, deleted: false}});
    const remote = state([{id: 2}], {
        '1': {at: 200, deleted: true},
        '2': {at: 150, deleted: false},
    });
    assert.deepEqual(ids(mergeWatchlistState(local, remote)), [2]);
});

test('a local removal survives a stale remote copy of the same movie', () => {
    const local = state([], {'1': {at: 300, deleted: true}});
    const remote = state([{id: 1}], {'1': {at: 100, deleted: false}});
    assert.deepEqual(ids(mergeWatchlistState(local, remote)), []);
});

test('an unmarked legacy remote entry is kept rather than dropped', () => {
    const local = state([]);
    const remote = state([{id: 9}]);
    assert.deepEqual(ids(mergeWatchlistState(local, remote)), [9]);
});

test('a local delete beats an unmarked legacy remote entry', () => {
    const local = state([], {'9': {at: 1, deleted: true}});
    const remote = state([{id: 9}]);
    assert.deepEqual(ids(mergeWatchlistState(local, remote)), []);
});

test('an add and a delete stamped at the same instant keep the movie', () => {
    const local = state([{id: 4}], {'4': {at: 700, deleted: false}});
    const remote = state([], {'4': {at: 700, deleted: true}});
    assert.deepEqual(ids(mergeWatchlistState(local, remote)), [4]);
    assert.deepEqual(ids(mergeWatchlistState(remote, local)), [4]);
});

test('two devices editing independently converge on the same watchlist', () => {
    const shared: WatchlistState<Entry> = state([{id: 1}, {id: 2}], {
        '1': {at: 100, deleted: false},
        '2': {at: 100, deleted: false},
    });
    const phone = state([{id: 1}, {id: 2}, {id: 3}], {
        ...shared.marks,
        '3': {at: 200, deleted: false},
    });
    const browser = state([{id: 2}], {...shared.marks, '1': {at: 210, deleted: true}});

    const onPhone = mergeWatchlistState(phone, browser);
    const onBrowser = mergeWatchlistState(browser, onPhone);

    assert.deepEqual(ids(onPhone).sort(), [2, 3]);
    assert.deepEqual(ids(onBrowser).sort(), [2, 3]);
    assert.deepEqual(onPhone.marks, onBrowser.marks);
});

test('merging is idempotent once both sides agree', () => {
    const local = state([{id: 1}], {'1': {at: 100, deleted: false}});
    const once = mergeWatchlistState(local, local);
    const twice = mergeWatchlistState(once, once);
    assert.ok(sameWatchlistState(once, twice));
});

test('merge keeps local ordering first and appends only unseen remote entries', () => {
    const local = state([{id: 3}, {id: 1}]);
    const remote = state([{id: 1}, {id: 4}, {id: 2}]);
    assert.deepEqual(ids(mergeWatchlistState(local, remote)), [3, 1, 4, 2]);
});

test('merge with an empty side returns the other side unchanged', () => {
    assert.deepEqual(ids(mergeWatchlistState(state([]), state([{id: 1}]))), [1]);
    assert.deepEqual(ids(mergeWatchlistState(state([{id: 1}]), state([]))), [1]);
});

test('pruneMarks retires only tombstones past the horizon', () => {
    const marks: WatchlistMarks = {
        '1': {at: 0, deleted: true},
        '2': {at: 0, deleted: false},
        '3': {at: 950, deleted: true},
    };
    assert.deepEqual(pruneMarks(marks, 1000, 100), {
        '2': {at: 0, deleted: false},
        '3': {at: 950, deleted: true},
    });
});

test('sameWatchlistState ignores mark insertion order but not content', () => {
    const a = state([{id: 1}], {'1': {at: 5, deleted: false}, '2': {at: 6, deleted: true}});
    const b = state([{id: 1}], {'2': {at: 6, deleted: true}, '1': {at: 5, deleted: false}});
    assert.equal(sameWatchlistState(a, b), true);
    const c = state([{id: 1}], {'1': {at: 7, deleted: false}, '2': {at: 6, deleted: true}});
    assert.equal(sameWatchlistState(a, c), false);
});

test('sameWatchlistState notices a different item order', () => {
    assert.equal(sameWatchlistState(state([{id: 1}, {id: 2}]), state([{id: 2}, {id: 1}])), false);
});

test('an oversized watchlist is trimmed to fit rather than abandoned', () => {
    const items = Array.from({length: 200}, (_, index) => ({
        id: index,
        title: 'x'.repeat(50),
    }));
    const fitted = fitWatchlistPayload(state(items), 2000);
    assert.equal(fitted.trimmed, true);
    assert.ok(fitted.payload.length <= 2000);
    const parsed = parseWatchlistState<Entry>(fitted.payload);
    assert.ok(parsed.items.length > 0);
    assert.ok(parsed.items.length < items.length);
    assert.deepEqual(ids(parsed), parsed.items.map((_, index) => index));
});

test('a watchlist within budget is left whole', () => {
    const fitted = fitWatchlistPayload(state([{id: 1}, {id: 2}]), 10000);
    assert.equal(fitted.trimmed, false);
    assert.deepEqual(ids(parseWatchlistState<Entry>(fitted.payload)), [1, 2]);
});

test('marks too large for the budget collapse to an empty payload that still fits', () => {
    const marks: WatchlistMarks = {};
    Array.from({length: 500}, (_, index) => index).forEach((index) => {
        marks[String(index)] = {at: 1700000000000 + index, deleted: true};
    });
    const fitted = fitWatchlistPayload(state([{id: 1}], marks), 200);
    assert.equal(fitted.trimmed, true);
    assert.ok(fitted.payload.length <= 200);
});

test('a preferences payload within budget is returned verbatim', () => {
    const value = {theme: 'dark'};
    assert.equal(payloadWithinBudget(value, 10000), JSON.stringify(value));
});

test('an oversized preferences payload is refused', () => {
    assert.equal(payloadWithinBudget({pad: 'x'.repeat(500)}, 100), null);
});
