import assert from 'node:assert/strict';
import test from 'node:test';

import type {HistoryEntry} from '../entities/HistoryEntry.ts';
import {
    clearHistory,
    emptyHistoryState,
    encodeHistoryState,
    fitHistoryPayload,
    HISTORY_LIMIT,
    HISTORY_TOMBSTONE_HORIZON_MS,
    type HistoryState,
    liveHistory,
    mergeHistoryState,
    parseHistoryState,
    pruneTombstones,
    recordHistory,
    removeHistory,
    sameHistoryState,
    sortHistory,
} from './historyMerge.ts';

function entry(key: string, watchedAt: number, title = key): HistoryEntry {
    return {key, title, watchedAt};
}

function state(
    entries: HistoryEntry[],
    removed: Record<string, number> = {},
    clearedAt = 0
): HistoryState {
    return {entries, removed, clearedAt};
}

function keys(next: HistoryState): string[] {
    return next.entries.map((item) => item.key);
}

test('an empty state round-trips through encode and parse', () => {
    const parsed = parseHistoryState(encodeHistoryState(emptyHistoryState()));
    assert.deepEqual(parsed, emptyHistoryState());
});

test('parsing junk yields an empty state rather than throwing', () => {
    assert.deepEqual(parseHistoryState(undefined), emptyHistoryState());
    assert.deepEqual(parseHistoryState('not json'), emptyHistoryState());
    assert.deepEqual(parseHistoryState('[]'), emptyHistoryState());
    assert.deepEqual(parseHistoryState('null'), emptyHistoryState());
});

test('parsing drops entries missing a key, title or timestamp', () => {
    const raw = JSON.stringify({
        entries: [
            {key: 'movie:1', title: 'One', watchedAt: 10},
            {key: '', title: 'Blank', watchedAt: 10},
            {key: 'movie:2', watchedAt: 10},
            {key: 'movie:3', title: 'Three'},
            {key: 'movie:4', title: 'Four', watchedAt: Number.NaN},
            null,
            'nope',
        ],
        removed: {'movie:9': 5, 'movie:8': 'nope'},
        clearedAt: 3,
    });
    const parsed = parseHistoryState(raw);
    assert.deepEqual(keys(parsed), ['movie:1']);
    assert.deepEqual(parsed.removed, {'movie:9': 5});
    assert.equal(parsed.clearedAt, 3);
});

test('parsing keeps the optional fields it recognises and drops the rest', () => {
    const raw = JSON.stringify({
        entries: [
            {
                key: 'movie:1',
                title: 'One',
                watchedAt: 10,
                imageUrl: 'https://example.test/a.jpg',
                year: 2001,
                rating: 7.5,
                runtimeMinutes: 120,
                torrents: [{hash: 'x'}],
            },
        ],
    });
    assert.deepEqual(parseHistoryState(raw).entries[0], {
        key: 'movie:1',
        title: 'One',
        watchedAt: 10,
        imageUrl: 'https://example.test/a.jpg',
        year: 2001,
        rating: 7.5,
        runtimeMinutes: 120,
    });
});

test('parsing collapses a duplicated key to its newest watch', () => {
    const raw = JSON.stringify({
        entries: [entry('movie:1', 10), entry('movie:1', 50), entry('movie:1', 30)],
    });
    const parsed = parseHistoryState(raw);
    assert.equal(parsed.entries.length, 1);
    assert.equal(parsed.entries[0].watchedAt, 50);
});

test('ordering is newest first with a stable key tiebreak', () => {
    const sorted = sortHistory([
        entry('movie:2', 100),
        entry('movie:9', 300),
        entry('movie:1', 100),
    ]);
    assert.deepEqual(
        sorted.map((item) => item.key),
        ['movie:9', 'movie:1', 'movie:2']
    );
});

test('recording promotes a rewatched title to the top', () => {
    let next = state([entry('movie:1', 10), entry('movie:2', 20)]);
    next = recordHistory(next, entry('movie:1', 30));
    assert.deepEqual(keys(next), ['movie:1', 'movie:2']);
    assert.equal(next.entries[0].watchedAt, 30);
    assert.equal(next.entries.length, 2);
});

test('recording wins over a stale entry even when the clock went backwards', () => {
    const next = recordHistory(state([entry('movie:1', 100)]), entry('movie:1', 40, 'Fresh'));
    assert.equal(next.entries.length, 1);
    assert.equal(next.entries[0].watchedAt, 40);
    assert.equal(next.entries[0].title, 'Fresh');
});

test('recording a previously removed title clears its tombstone', () => {
    const removedState = removeHistory(state([entry('movie:1', 10)]), 'movie:1', 20);
    assert.deepEqual(removedState.removed, {'movie:1': 20});
    const next = recordHistory(removedState, entry('movie:1', 30));
    assert.deepEqual(next.removed, {});
    assert.deepEqual(keys(next), ['movie:1']);
});

test('recording caps the list at the history limit', () => {
    let next = emptyHistoryState();
    for (let index = 0; index < HISTORY_LIMIT + 25; index += 1) {
        next = recordHistory(next, entry(`movie:${index}`, index));
    }
    assert.equal(next.entries.length, HISTORY_LIMIT);
    assert.equal(next.entries[0].key, `movie:${HISTORY_LIMIT + 24}`);
});

test('removing stamps a tombstone that outlives the entry', () => {
    const next = removeHistory(state([entry('movie:1', 10), entry('movie:2', 20)]), 'movie:1', 50);
    assert.deepEqual(keys(next), ['movie:2']);
    assert.deepEqual(next.removed, {'movie:1': 50});
});

test('removing an absent key changes nothing', () => {
    const before = state([entry('movie:1', 10)]);
    assert.equal(removeHistory(before, 'movie:404', 50), before);
});

test('a tombstone always supersedes the entry it buries', () => {
    const next = removeHistory(state([entry('movie:1', 900)]), 'movie:1', 50);
    assert.equal(next.removed['movie:1'], 900);
    assert.deepEqual(liveHistory(next), []);
});

test('clearing drops every entry without stamping one tombstone per title', () => {
    const before = state([entry('movie:1', 10), entry('movie:2', 20), entry('movie:3', 30)]);
    const next = clearHistory(before, 100);
    assert.deepEqual(next.entries, []);
    assert.deepEqual(next.removed, {});
    assert.equal(next.clearedAt, 100);
});

test('clearing buries a future-stamped entry without moving the horizon past now', () => {
    const next = clearHistory(state([entry('movie:1', 9000)]), 100);
    assert.equal(next.clearedAt, 100);
    assert.equal(next.removed['movie:1'], 9000);
    assert.deepEqual(liveHistory(next), []);
});

test('a clear does not blind history to watches made after it', () => {
    const cleared = clearHistory(state([entry('movie:1', 9000)]), 100);
    const next = recordHistory(cleared, entry('movie:2', 200));
    assert.deepEqual(liveHistory(next).map((item) => item.key), ['movie:2']);
});

test('a clear keeps a tombstone it does not subsume, so a removal is not undone', () => {
    const removedState = removeHistory(state([entry('movie:1', 9000)]), 'movie:1', 50);
    assert.equal(removedState.removed['movie:1'], 9000);
    const cleared = clearHistory(removedState, 100);
    assert.equal(cleared.removed['movie:1'], 9000);
    const merged = mergeHistoryState(cleared, state([entry('movie:1', 9000)]));
    assert.deepEqual(keys(merged), []);
});

test('a fresh watch outranks a tombstone stamped into the future', () => {
    const removedState = removeHistory(state([entry('movie:1', 9000)]), 'movie:1', 50);
    const next = recordHistory(removedState, entry('movie:1', 200, 'Rewatch'));
    assert.deepEqual(liveHistory(next).map((item) => item.key), ['movie:1']);
    assert.equal(next.entries[0].title, 'Rewatch');
});

test('a fresh watch outranks a clear horizon stamped in the same millisecond', () => {
    const cleared = clearHistory(state([entry('movie:1', 50)]), 100);
    const next = recordHistory(cleared, entry('movie:1', 100));
    assert.deepEqual(liveHistory(next).map((item) => item.key), ['movie:1']);
});

test('merging a watchedAt tie picks the same entry whichever side it arrived from', () => {
    const mine = {key: 'movie:1', title: 'Zulu', watchedAt: 500, year: 2001};
    const theirs = {key: 'movie:1', title: 'Alpha', watchedAt: 500, year: 1999};
    const forward = mergeHistoryState(state([mine]), state([theirs]));
    const backward = mergeHistoryState(state([theirs]), state([mine]));
    assert.deepEqual(forward, backward);
    assert.equal(forward.entries[0].title, 'Alpha');
});

test('merging is associative, which is what a third device needs', () => {
    const a = state([entry('movie:1', 10), entry('movie:2', 90)], {'movie:5': 40}, 5);
    const b = state([entry('movie:2', 60), entry('movie:3', 30)], {'movie:1': 20}, 8);
    const c = state([entry('movie:3', 70), entry('movie:4', 15)], {'movie:2': 95}, 2);
    assert.deepEqual(
        mergeHistoryState(mergeHistoryState(a, b), c),
        mergeHistoryState(a, mergeHistoryState(b, c))
    );
});

test('a tombstone map too large to fit keeps the newest tombstones rather than dropping all', () => {
    const removed: Record<string, number> = {};
    for (let index = 0; index < 400; index += 1) removed[`movie:${index}`] = index;
    const fitted = fitHistoryPayload(state([entry('movie:999', 5000)], removed, 0), 900);
    assert.equal(fitted.trimmed, true);
    const parsed = parseHistoryState(fitted.payload);
    assert.ok(fitted.payload.length <= 900);
    const kept = Object.keys(parsed.removed);
    assert.ok(kept.length > 0);
    assert.ok(kept.every((key) => parsed.removed[key] >= 400 - kept.length));
});

test('a trimmed payload is a fixed point, so an oversized history stops re-pushing', () => {
    const entries: HistoryEntry[] = [];
    for (let index = 0; index < 300; index += 1) {
        entries.push(entry(`movie:${index}`, index * 1000, `Title number ${index}`));
    }
    const budget = 12000;
    let local = state(entries);
    let document: string | undefined;
    let pushes = 0;
    for (let pass = 0; pass < 12; pass += 1) {
        const remote = parseHistoryState(document);
        const merged = mergeHistoryState(local, remote);
        local = merged;
        const fitted = fitHistoryPayload(merged, budget);
        if (!sameHistoryState(parseHistoryState(fitted.payload), remote)) {
            document = fitted.payload;
            pushes += 1;
        }
    }
    assert.equal(pushes, 1);
});

test('a watch after a clear survives the clear', () => {
    const cleared = clearHistory(state([entry('movie:1', 10)]), 100);
    const next = recordHistory(cleared, entry('movie:1', 150));
    assert.deepEqual(keys(next), ['movie:1']);
    assert.deepEqual(liveHistory(next).map((item) => item.key), ['movie:1']);
});

test('merging is commutative for entries, tombstones and clears', () => {
    const local = state([entry('movie:1', 10), entry('movie:2', 40)], {'movie:3': 70}, 5);
    const remote = state([entry('movie:2', 60), entry('movie:3', 30)], {'movie:1': 20}, 8);
    const forward = mergeHistoryState(local, remote);
    const backward = mergeHistoryState(remote, local);
    assert.deepEqual(forward, backward);
});

test('merging is idempotent', () => {
    const local = state([entry('movie:1', 10), entry('movie:2', 40)], {'movie:3': 70}, 5);
    const remote = state([entry('movie:2', 60), entry('movie:3', 30)], {'movie:1': 20}, 8);
    const once = mergeHistoryState(local, remote);
    assert.deepEqual(mergeHistoryState(once, once), once);
    assert.deepEqual(mergeHistoryState(once, remote), once);
});

test('merging keeps the newer watch of a title seen on both devices', () => {
    const merged = mergeHistoryState(
        state([entry('movie:1', 10, 'Stale')]),
        state([entry('movie:1', 90, 'Fresh')])
    );
    assert.equal(merged.entries.length, 1);
    assert.equal(merged.entries[0].watchedAt, 90);
    assert.equal(merged.entries[0].title, 'Fresh');
});

test('a remote removal buries a local entry watched before it', () => {
    const merged = mergeHistoryState(
        state([entry('movie:1', 10)]),
        state([], {'movie:1': 20})
    );
    assert.deepEqual(keys(merged), []);
    assert.deepEqual(merged.removed, {'movie:1': 20});
});

test('a rewatch after a remote removal wins', () => {
    const merged = mergeHistoryState(
        state([entry('movie:1', 30)]),
        state([], {'movie:1': 20})
    );
    assert.deepEqual(keys(merged), ['movie:1']);
});

test('a remote clear buries local entries older than the horizon', () => {
    const merged = mergeHistoryState(
        state([entry('movie:1', 10), entry('movie:2', 80)]),
        state([], {}, 50)
    );
    assert.deepEqual(keys(merged), ['movie:2']);
    assert.equal(merged.clearedAt, 50);
});

test('a clear retires the tombstones it subsumes', () => {
    const merged = mergeHistoryState(
        state([], {'movie:1': 10, 'movie:2': 80}),
        state([], {}, 50)
    );
    assert.deepEqual(merged.removed, {'movie:2': 80});
});

test('merging caps the union at the history limit deterministically', () => {
    const local: HistoryEntry[] = [];
    const remote: HistoryEntry[] = [];
    for (let index = 0; index < HISTORY_LIMIT; index += 1) {
        local.push(entry(`movie:a${index}`, index * 2));
        remote.push(entry(`movie:b${index}`, index * 2 + 1));
    }
    const merged = mergeHistoryState(state(local), state(remote));
    assert.equal(merged.entries.length, HISTORY_LIMIT);
    assert.deepEqual(merged, mergeHistoryState(state(remote), state(local)));
});

test('two devices converge without ping-ponging pushes', () => {
    let deviceA = state([entry('movie:1', 10), entry('movie:5', 50)]);
    let deviceB = state([entry('movie:2', 20), entry('movie:9', 90)]);
    let remote = emptyHistoryState();

    deviceA = mergeHistoryState(deviceA, remote);
    remote = deviceA;
    deviceB = mergeHistoryState(deviceB, remote);
    remote = deviceB;
    deviceA = mergeHistoryState(deviceA, remote);

    assert.ok(sameHistoryState(deviceA, remote));
    assert.ok(sameHistoryState(mergeHistoryState(deviceB, remote), remote));
    assert.deepEqual(keys(deviceA), ['movie:9', 'movie:5', 'movie:2', 'movie:1']);
});

test('ordering does not depend on which side an entry arrived from', () => {
    const local = state([entry('movie:1', 10), entry('movie:3', 30)]);
    const remote = state([entry('movie:2', 20), entry('movie:4', 40)]);
    assert.deepEqual(
        keys(mergeHistoryState(local, remote)),
        keys(mergeHistoryState(remote, local))
    );
});

test('same-state comparison notices entries, order, timestamps, tombstones and clears', () => {
    const base = state([entry('movie:2', 20), entry('movie:1', 10)], {'movie:3': 5}, 1);
    assert.ok(sameHistoryState(base, state([entry('movie:2', 20), entry('movie:1', 10)], {'movie:3': 5}, 1)));
    assert.ok(!sameHistoryState(base, state([entry('movie:1', 10), entry('movie:2', 20)], {'movie:3': 5}, 1)));
    assert.ok(!sameHistoryState(base, state([entry('movie:2', 21), entry('movie:1', 10)], {'movie:3': 5}, 1)));
    assert.ok(!sameHistoryState(base, state([entry('movie:2', 20), entry('movie:1', 10)], {}, 1)));
    assert.ok(!sameHistoryState(base, state([entry('movie:2', 20), entry('movie:1', 10)], {'movie:3': 6}, 1)));
    assert.ok(!sameHistoryState(base, state([entry('movie:2', 20), entry('movie:1', 10)], {'movie:3': 5}, 2)));
});

test('pruning retires tombstones past the horizon and those a clear subsumes', () => {
    const now = HISTORY_TOMBSTONE_HORIZON_MS * 2;
    const removed = {
        'movie:old': now - HISTORY_TOMBSTONE_HORIZON_MS - 1,
        'movie:fresh': now - 10,
        'movie:cleared': 40,
    };
    assert.deepEqual(pruneTombstones(removed, 50, now), {'movie:fresh': now - 10});
});

test('a tombstone key that collides with Object.prototype is still a real tombstone', () => {
    const hostile = parseHistoryState('{"entries":[],"removed":{"__proto__":50},"clearedAt":0}');
    assert.equal(Object.prototype.hasOwnProperty.call(hostile.removed, '__proto__'), true);
    const forward = mergeHistoryState(state([entry('__proto__', 10)]), hostile);
    const backward = mergeHistoryState(hostile, state([entry('__proto__', 10)]));
    assert.deepEqual(forward, backward);
    assert.deepEqual(keys(forward), []);
    assert.equal(Object.prototype.hasOwnProperty.call(forward.removed, '__proto__'), true);
});

test('clearing buries a future-stamped entry whose key collides with Object.prototype', () => {
    const cleared = clearHistory(state([entry('__proto__', 9000)]), 100);
    assert.equal(cleared.removed['__proto__'], 9000);
    assert.deepEqual(liveHistory(mergeHistoryState(cleared, state([entry('__proto__', 9000)]))), []);
});

test('a hostile document never pollutes Object.prototype', () => {
    parseHistoryState('{"entries":[],"removed":{"__proto__":{"polluted":true}},"clearedAt":0}');
    mergeHistoryState(
        parseHistoryState('{"entries":[],"removed":{"__proto__":7},"clearedAt":0}'),
        emptyHistoryState()
    );
    assert.equal(({} as Record<string, unknown>).polluted, undefined);
});

test('a history at the entry cap and over the byte budget settles with a lagging device', () => {
    const budget = 8000;
    const full: HistoryEntry[] = [];
    for (let index = 0; index < HISTORY_LIMIT; index += 1) {
        full.push(entry(`movie:a${index}`, 10000 + index));
    }
    let deviceA = state(full);
    let deviceB = state([entry('movie:straggler', 1)]);
    let document: string | undefined;
    let writes = 0;

    const poll = (local: HistoryState): HistoryState => {
        const remote = parseHistoryState(document);
        const merged = mergeHistoryState(local, remote);
        const fitted = fitHistoryPayload(merged, budget);
        const publishable = parseHistoryState(fitted.payload);
        if (!sameHistoryState(mergeHistoryState(publishable, remote), remote)) {
            document = fitted.payload;
            writes += 1;
        }
        return merged;
    };

    for (let round = 0; round < 10; round += 1) {
        deviceA = poll(deviceA);
        deviceB = poll(deviceB);
    }
    const settled = writes;
    for (let round = 0; round < 10; round += 1) {
        deviceA = poll(deviceA);
        deviceB = poll(deviceB);
    }
    assert.equal(writes - settled, 0);
    assert.ok(parseHistoryState(document).entries.length > 0);
});

test('a poorer document never overwrites a richer one, but a richer one still publishes', () => {
    const remote = state([entry('movie:2', 20), entry('movie:1', 10)]);
    const poorer = state([entry('movie:1', 10)]);
    assert.ok(sameHistoryState(mergeHistoryState(poorer, remote), remote));
    const richer = state([entry('movie:3', 30), entry('movie:2', 20), entry('movie:1', 10)]);
    assert.ok(!sameHistoryState(mergeHistoryState(richer, remote), remote));
    const withRemoval = removeHistory(remote, 'movie:1', 99);
    assert.ok(!sameHistoryState(mergeHistoryState(withRemoval, remote), remote));
});

test('a payload within budget is not trimmed', () => {
    const fitted = fitHistoryPayload(state([entry('movie:1', 10)]), 100000);
    assert.equal(fitted.trimmed, false);
    assert.deepEqual(keys(parseHistoryState(fitted.payload)), ['movie:1']);
});

test('an oversized payload sheds its oldest entries first', () => {
    const entries = [entry('movie:1', 30), entry('movie:2', 20), entry('movie:3', 10)];
    const full = encodeHistoryState(state(entries));
    const fitted = fitHistoryPayload(state(entries), full.length - 1);
    assert.equal(fitted.trimmed, true);
    const parsed = parseHistoryState(fitted.payload);
    assert.ok(parsed.entries.length < entries.length);
    assert.ok(!keys(parsed).includes('movie:3'));
});

test('a payload that cannot fit at all collapses but keeps the clear horizon', () => {
    const fitted = fitHistoryPayload(state([entry('movie:1', 10)], {'movie:2': 5}, 77), 10);
    assert.equal(fitted.trimmed, true);
    const parsed = parseHistoryState(fitted.payload);
    assert.deepEqual(parsed.entries, []);
    assert.equal(parsed.clearedAt, 77);
});
