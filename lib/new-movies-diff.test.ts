import assert from 'node:assert/strict';
import test from 'node:test';
import {buildNotificationContent, selectNewMovies} from './new-movies-diff.ts';

const movie = (id: number, title: string) => ({id, title}) as any;

test('selectNewMovies returns only ids absent from the cache', () => {
    const cached = new Set([1, 2, 3]);
    const fetched = [movie(3, 'C'), movie(4, 'D'), movie(5, 'E')];
    const result = selectNewMovies(cached, fetched);
    assert.deepEqual(result.map((m) => m.id), [4, 5]);
});

test('selectNewMovies returns empty when nothing is new', () => {
    const cached = new Set([1, 2]);
    assert.deepEqual(selectNewMovies(cached, [movie(1, 'A'), movie(2, 'B')]), []);
});

test('single new movie -> deep-link payload with movieId', () => {
    const content = buildNotificationContent([movie(42, 'Dune')]);
    assert.equal(content.title, 'New movie added');
    assert.equal(content.body, 'Dune');
    assert.deepEqual(content.data, {movieId: 42});
});

test('multiple new movies -> count payload, no movieId, titles preview', () => {
    const content = buildNotificationContent([
        movie(1, 'A'),
        movie(2, 'B'),
        movie(3, 'C'),
        movie(4, 'D'),
    ]);
    assert.equal(content.title, '4 new movies');
    assert.equal(content.body, 'A, B, C');
    assert.deepEqual(content.data, {count: 4});
    assert.ok(!('movieId' in content.data));
});
