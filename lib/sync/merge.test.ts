import assert from 'node:assert/strict';
import test from 'node:test';

import {
    chooseSyncMode,
    parseWatchlist,
    payloadWithinBudget,
    resolveSection,
    unionWatchlist,
} from './merge.ts';

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

test('equal timestamps do not cause a redundant write', () => {
    assert.equal(resolveSection('union', 0, 0), 'in-sync');
});

test('parseWatchlist survives absent, malformed and non-array payloads', () => {
    assert.deepEqual(parseWatchlist(undefined), []);
    assert.deepEqual(parseWatchlist(''), []);
    assert.deepEqual(parseWatchlist('not json'), []);
    assert.deepEqual(parseWatchlist('{"id":1}'), []);
});

test('parseWatchlist drops entries without a numeric id', () => {
    const raw = JSON.stringify([{id: 1}, {id: '2'}, null, {title: 'x'}, {id: 3}]);
    assert.deepEqual(parseWatchlist(raw), [{id: 1}, {id: 3}]);
});

test('union keeps local order first and appends only unseen remote entries', () => {
    const local = [{id: 3}, {id: 1}];
    const remote = [{id: 1}, {id: 4}, {id: 2}];
    assert.deepEqual(unionWatchlist(local, remote), [{id: 3}, {id: 1}, {id: 4}, {id: 2}]);
});

test('union with an empty side returns the other side unchanged', () => {
    assert.deepEqual(unionWatchlist([], [{id: 1}]), [{id: 1}]);
    assert.deepEqual(unionWatchlist([{id: 1}], []), [{id: 1}]);
});

test('an oversized payload is refused rather than silently truncated', () => {
    const items = Array.from({length: 200}, (_, index) => ({id: index, pad: 'x'.repeat(50)}));
    assert.equal(payloadWithinBudget(items, 2000), null);
});

test('a payload within budget is returned verbatim', () => {
    const items = [{id: 1}, {id: 2}];
    assert.equal(payloadWithinBudget(items, 10000), JSON.stringify(items));
});

test('a payload exactly on the budget is accepted', () => {
    const json = JSON.stringify([{id: 1}]);
    assert.equal(payloadWithinBudget([{id: 1}], json.length), json);
});
