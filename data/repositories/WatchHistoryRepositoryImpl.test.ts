import assert from 'node:assert/strict';
import test from 'node:test';
import {createRequire} from 'node:module';
import type {HistoryEntry, HistoryState, WatchHistoryRepository} from '../../domain/index.ts';

const require = createRequire(import.meta.url);
const {loadTypeScript} = require('../../tests/helpers/load-typescript.cjs');
const {WatchHistoryRepositoryImpl} = loadTypeScript('data/repositories/WatchHistoryRepositoryImpl.ts');
const {encodeHistoryState, liveHistory} = loadTypeScript('domain/policies/historyMerge.ts');

const first: HistoryEntry = {key: 'movie:1', title: 'First movie', watchedAt: 10};
const second: HistoryEntry = {key: 'movie:2', title: 'Second movie', watchedAt: 20};
const initial: HistoryState = {entries: [first], removed: {'movie:3': 5}, clearedAt: 1};
const remote: HistoryState = {entries: [second], removed: {'movie:1': 30}, clearedAt: 2};

function fixture() {
    const values = new Map([['state', encodeHistoryState(initial) as string]]);
    let fail = false;
    let attempts = 0;
    const store = {
        getString: (key: string) => values.get(key),
        set: (key: string, value: string) => {
            attempts += 1;
            if (fail) throw new Error('disk full');
            values.set(key, value);
        },
        delete: (key: string) => {values.delete(key);},
    };
    return {values, store, repository: new WatchHistoryRepositoryImpl(store) as WatchHistoryRepository,
        setFailure: (value: boolean) => {fail = value;}, attempts: () => attempts};
}

for (const {name, mutate, expected} of [
    {name: 'record', mutate: (repository: WatchHistoryRepository) => repository.record(second),
        expected: {...initial, entries: [second, first]}},
    {name: 'repeat viewing', mutate: (repository: WatchHistoryRepository) => repository.record({...first, watchedAt: 40}),
        expected: {...initial, entries: [{...first, watchedAt: 40}]}},
    {name: 'remove', mutate: (repository: WatchHistoryRepository) => repository.remove(first.key),
        expected: {...initial, entries: [], removed: {...initial.removed, [first.key]: 100}}},
    {name: 'clear', mutate: (repository: WatchHistoryRepository) => repository.clear(),
        expected: {entries: [], removed: {}, clearedAt: 100}},
    {name: 'remote replacement', mutate: (repository: WatchHistoryRepository) => repository.applyRemote(remote),
        expected: remote},
]) {
    test(`failed history ${name} preserves storage, state and snapshot until a successful retry`, t => {
        t.mock.method(Date, 'now', () => 100);
        const {repository, store, values, setFailure, attempts} = fixture();
        const beforeState = repository.getState();
        const beforeSnapshot = repository.getAll();
        const persisted = values.get('state');
        const notifications: HistoryEntry[][] = [];
        repository.subscribe(() => {
            notifications.push(repository.getAll());
            const restored = new WatchHistoryRepositoryImpl(store);
            assert.deepEqual(restored.getState(), repository.getState());
            assert.deepEqual(restored.getAll(), repository.getAll());
        });

        setFailure(true);
        assert.throws(() => mutate(repository), /disk full/);
        assert.equal(attempts(), 1);
        assert.equal(values.get('state'), persisted);
        assert.equal(repository.getState(), beforeState);
        assert.equal(repository.getAll(), beforeSnapshot);
        assert.deepEqual(repository.getState(), initial);
        assert.deepEqual(notifications, []);

        setFailure(false);
        mutate(repository);
        assert.equal(attempts(), 2);
        assert.deepEqual(repository.getState(), expected);
        assert.equal(values.get('state'), encodeHistoryState(expected));
        assert.deepEqual(repository.getAll(), liveHistory(expected));
        assert.deepEqual(notifications, [liveHistory(expected)]);
    });
}
