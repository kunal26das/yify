import assert from 'node:assert/strict';
import test from 'node:test';
import {
    NOTIFICATION_BURST_LIMIT,
    buildNotificationBatch,
    buildNotificationContent,
    filterNotifiableMovies,
    isWithinQuietHours,
    notificationQuerySignature,
    quietHoursEndAt,
    selectNewMovies,
} from './newMoviesNotification.ts';

const movie = (id: number, title: string) => ({id, title}) as any;

const rated = (id: number, rating: number, genres: string[]) =>
    ({id, title: `M${id}`, rating, genres}) as any;

const at = (hour: number, minute = 0) => new Date(2026, 2, 1, hour, minute, 0, 0);

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

test('filterNotifiableMovies keeps a title exactly on the rating floor', () => {
    const movies = [rated(1, 6.9, []), rated(2, 7, []), rated(3, 8.4, [])];
    const result = filterNotifiableMovies(movies, {minimumRating: 7, genre: ''});
    assert.deepEqual(result.map((m) => m.id), [2, 3]);
});

test('filterNotifiableMovies with no floor and no genre keeps everything', () => {
    const movies = [rated(1, 0, []), rated(2, 3.2, ['Drama'])];
    assert.deepEqual(filterNotifiableMovies(movies, {minimumRating: 0, genre: ''}), movies);
});

test('filterNotifiableMovies matches genres case-insensitively', () => {
    const movies = [rated(1, 8, ['Sci-Fi']), rated(2, 8, ['Drama'])];
    const result = filterNotifiableMovies(movies, {minimumRating: 0, genre: 'sci-fi'});
    assert.deepEqual(result.map((m) => m.id), [1]);
});

test('filterNotifiableMovies applies rating and genre together', () => {
    const movies = [rated(1, 6, ['Action']), rated(2, 9, ['Action']), rated(3, 9, ['Comedy'])];
    const result = filterNotifiableMovies(movies, {minimumRating: 7, genre: 'action'});
    assert.deepEqual(result.map((m) => m.id), [2]);
});

test('isWithinQuietHours handles a window that wraps midnight', () => {
    assert.equal(isWithinQuietHours(at(23), 22, 8), true);
    assert.equal(isWithinQuietHours(at(3), 22, 8), true);
    assert.equal(isWithinQuietHours(at(22), 22, 8), true);
    assert.equal(isWithinQuietHours(at(8), 22, 8), false);
    assert.equal(isWithinQuietHours(at(9), 22, 8), false);
    assert.equal(isWithinQuietHours(at(21), 22, 8), false);
});

test('isWithinQuietHours handles a window inside one day', () => {
    assert.equal(isWithinQuietHours(at(12), 9, 17), true);
    assert.equal(isWithinQuietHours(at(20), 9, 17), false);
    assert.equal(isWithinQuietHours(at(8), 9, 17), false);
});

test('equal start and end hours means never quiet', () => {
    assert.equal(isWithinQuietHours(at(8), 8, 8), false);
    assert.equal(isWithinQuietHours(at(3), 8, 8), false);
});

test('quietHoursEndAt lands on the next occurrence of the end hour', () => {
    const tonight = quietHoursEndAt(at(23, 30), 22, 8);
    assert.deepEqual(tonight, new Date(2026, 2, 2, 8, 0, 0, 0));

    const earlyMorning = quietHoursEndAt(at(3, 30), 22, 8);
    assert.deepEqual(earlyMorning, new Date(2026, 2, 1, 8, 0, 0, 0));

    assert.equal(quietHoursEndAt(at(12), 22, 8), null);
});

test('buildNotificationBatch splits per title only under the limit', () => {
    const three = [movie(1, 'A'), movie(2, 'B'), movie(3, 'C')];
    const batch = buildNotificationBatch(three, true, NOTIFICATION_BURST_LIMIT);
    assert.equal(batch.length, 3);
    assert.deepEqual(batch.map((item) => item.data), [{movieId: 1}, {movieId: 2}, {movieId: 3}]);
});

test('buildNotificationBatch falls back to one summary above the limit', () => {
    const six = [1, 2, 3, 4, 5, 6].map((id) => movie(id, `M${id}`));
    const batch = buildNotificationBatch(six, true, NOTIFICATION_BURST_LIMIT);
    assert.equal(batch.length, 1);
    assert.deepEqual(batch[0].data, {count: 6});
});

test('buildNotificationBatch stays grouped when per title is off', () => {
    const three = [movie(1, 'A'), movie(2, 'B'), movie(3, 'C')];
    assert.equal(buildNotificationBatch(three, false, NOTIFICATION_BURST_LIMIT).length, 1);
});

test('notificationQuerySignature distinguishes every quality including all', () => {
    assert.equal(notificationQuerySignature(''), 'q:all');
    assert.equal(notificationQuerySignature('2160p'), 'q:2160p');
    assert.notEqual(notificationQuerySignature('1080p'), notificationQuerySignature('1080p.x265'));
});
