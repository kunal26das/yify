import assert from 'node:assert/strict';
import test from 'node:test';
import {createRequire} from 'node:module';
import type {Movie, WatchlistRepository} from '../../domain/index.ts';

const require = createRequire(import.meta.url);
const {loadTypeScript} = require('../../tests/helpers/load-typescript.cjs');
const {WatchlistRepositoryImpl} = loadTypeScript('data/repositories/WatchlistRepositoryImpl.ts');

function movie(id: number): Movie {
    return {id, imdbCode: `tt${id}`, title: `Movie ${id}`, titleLong: `Movie ${id} (2026)`, year: 2026,
        rating: 7, runtimeMinutes: 90, genres: ['Drama'], summary: '', language: 'en', mpaRating: '', posterUrls: [],
        backgroundImageUrl: '', ytTrailerCode: '', thumbnailUrls: []};
}

function fixture(items: Movie[] = []) {
    const values = new Map([['items', JSON.stringify(items)]]);
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
    return {values, store, repository: new WatchlistRepositoryImpl(store) as WatchlistRepository,
        setFailure: (value: boolean) => {fail = value;}, attempts: () => attempts};
}

for (const {name, initial, mutate, expected} of [
    {name: 'add', initial: [movie(1)], mutate: (repository: WatchlistRepository) => repository.add(movie(2)), expected: [movie(2), movie(1)]},
    {name: 'remove', initial: [movie(2), movie(1)], mutate: (repository: WatchlistRepository) => repository.remove(2), expected: [movie(1)]},
    {name: 'clear', initial: [movie(2), movie(1)], mutate: (repository: WatchlistRepository) => repository.clear(), expected: []},
    {name: 'remote replacement', initial: [movie(1)], mutate: (repository: WatchlistRepository) => repository.applyRemote([movie(2)]), expected: [movie(2)]},
    {name: 'toggle on', initial: [movie(1)], mutate: (repository: WatchlistRepository) => repository.toggle(movie(2)), expected: [movie(2), movie(1)]},
    {name: 'toggle off', initial: [movie(2), movie(1)], mutate: (repository: WatchlistRepository) => repository.toggle(movie(2)), expected: [movie(1)]},
]) {
    test(`failed watchlist ${name} preserves storage, snapshot and membership until a successful retry`, () => {
        const {repository, store, values, setFailure, attempts} = fixture(initial);
        const before = repository.getAll();
        const persisted = values.get('items');
        const notifications: Movie[][] = [];
        repository.subscribe(() => {
            notifications.push(repository.getAll());
            assert.deepEqual(new WatchlistRepositoryImpl(store).getAll(), repository.getAll());
            for (const id of [1, 2]) assert.equal(repository.contains(id), expected.some(item => item.id === id));
        });

        setFailure(true);
        assert.throws(() => mutate(repository), /disk full/);
        assert.equal(attempts(), 1);
        assert.equal(values.get('items'), persisted);
        assert.equal(repository.getAll(), before);
        assert.deepEqual(repository.getAll(), initial);
        for (const id of [1, 2]) assert.equal(repository.contains(id), initial.some(item => item.id === id));
        assert.deepEqual(notifications, []);

        setFailure(false);
        mutate(repository);
        assert.equal(attempts(), 2);
        assert.deepEqual(repository.getAll(), expected);
        assert.deepEqual(JSON.parse(values.get('items')!), expected);
        assert.deepEqual(notifications, [expected]);
    });
}

test('watchlist activation is recorded only after the failed first save succeeds on retry', () => {
    const {store, values, setFailure} = fixture();
    const events: [string, unknown][] = [];
    const repository = new WatchlistRepositoryImpl(store, {
        trackEvent: (name: string, params: unknown) => {events.push([name, params]);},
    });

    setFailure(true);
    assert.throws(() => repository.add(movie(1)), /disk full/);
    assert.equal(repository.contains(1), false);
    assert.equal(values.get('funnel_saved_milestones_v1'), undefined);
    assert.deepEqual(events, []);

    setFailure(false);
    repository.add(movie(1));
    repository.add(movie(1));
    assert.equal(repository.contains(1), true);
    assert.equal(values.get('funnel_saved_milestones_v1'), '[1]');
    assert.deepEqual(events, [['watchlist_activation', {funnel_version: 'v1', app_platform: 'other', saved_milestone: 'one'}]]);
});
