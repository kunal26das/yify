import assert from 'node:assert/strict';
import test from 'node:test';

import type {JournalEntry, JournalMovie} from '../entities/Journal.ts';
import {journalInsights} from './journalInsights.ts';

function movie(overrides: Partial<JournalMovie> = {}): JournalMovie {
    return {id: 1, title: 'A movie', year: 2024, runtimeMinutes: 100,
        genres: ['Drama'], posterUrl: 'https://example.test/poster.jpg', ...overrides};
}

function entry(id: string, overrides: Partial<JournalEntry> = {}): JournalEntry {
    return {id, movie: movie(), watchedOn: '2026-09-19', rating: null,
        note: '', updatedAt: 100, deletedAt: 0, ...overrides};
}

test('empty journals and months do not invent ratings or runtime', () => {
    assert.deepEqual(journalInsights([]), {
        totalWatches: 0, distinctMovies: 0, repeatWatches: 0, ratedWatches: 0,
        averageRating: null, knownRuntimeMinutes: 0, unknownRuntimeCount: 0,
        topGenres: [], months: [], monthsTruncated: false, topRated: [], entriesTruncated: false,
    });
    assert.deepEqual(journalInsights([entry('one')], '2026-08'), journalInsights([]));
});

test('rewatches contribute to viewings and runtime while distinct titles stay unique', () => {
    const result = journalInsights([
        entry('first', {rating: 10, movie: movie({genres: ['Drama', 'Thriller', 'drama', ' Drama ']})}),
        entry('rewatch', {rating: 8, watchedOn: '2026-09-20'}),
        entry('second', {movie: movie({id: 2, runtimeMinutes: 90, genres: ['Thriller']})}),
    ]);
    assert.equal(result.totalWatches, 3);
    assert.equal(result.distinctMovies, 2);
    assert.equal(result.repeatWatches, 1);
    assert.equal(result.ratedWatches, 2);
    assert.equal(result.averageRating, 4.5);
    assert.equal(result.knownRuntimeMinutes, 290);
    assert.equal(result.unknownRuntimeCount, 0);
    assert.deepEqual(result.topGenres, [{name: 'Drama', count: 2}, {name: 'Thriller', count: 2}]);
    assert.equal(result.topRated[0].rating, 4);
    assert.equal(result.topRated[0].watches, 2);
});

test('month filtering uses the written calendar date, not edit time or UTC conversions', () => {
    const rows = [
        entry('august', {watchedOn: '2026-08-31', updatedAt: 9999, rating: 10}),
        entry('september', {watchedOn: '2026-09-01', updatedAt: 1, rating: 2}),
        entry('october', {watchedOn: '2026-10-01', rating: 8}),
    ];
    const result = journalInsights(rows, '2026-09');
    assert.equal(result.totalWatches, 1);
    assert.equal(result.averageRating, 1);
    assert.deepEqual(result.months, [{month: '2026-09', count: 1}]);
    assert.equal(result.topRated[0].rating, 1);
});

test('top rated uses the latest rated viewing, not maximum rating or most recently edited old viewing', () => {
    const rows = [
        entry('old', {watchedOn: '2026-09-01', rating: 10, updatedAt: 9999}),
        entry('new', {watchedOn: '2026-09-02', rating: 3, updatedAt: 1}),
        entry('unrated', {watchedOn: '2026-09-03', rating: null}),
        entry('other', {movie: movie({id: 2, title: 'Another movie'}), rating: 8}),
    ];
    const result = journalInsights(rows);
    assert.deepEqual(result.topRated.map(item => [item.movie.id, item.rating, item.watches]), [[2, 4, 1], [1, 1.5, 3]]);
    assert.equal(result.averageRating, 3.5);
});

test('half-star ratings stay precise; malformed ratings are unrated', () => {
    const invalid = [NaN, Infinity, -1, 0, 11, 1.5, '10', undefined];
    const result = journalInsights([
        entry('half', {rating: 1}),
        ...invalid.map((rating, index) => entry(`invalid-${index}`, {rating: rating as number})),
    ]);
    assert.equal(result.totalWatches, 9);
    assert.equal(result.ratedWatches, 1);
    assert.equal(result.averageRating, 0.5);
    assert.equal(result.topRated[0].rating, 0.5);
});

test('unknown runtime is counted explicitly and never adds guessed minutes', () => {
    const invalid = [0, -1, NaN, Infinity, 1441, 0.5, '100', undefined];
    const result = journalInsights([
        entry('known', {movie: movie({runtimeMinutes: 1440})}),
        ...invalid.map((runtimeMinutes, index) => entry(`unknown-${index}`, {
            movie: movie({runtimeMinutes: runtimeMinutes as number}),
        })),
    ]);
    assert.equal(result.knownRuntimeMinutes, 1440);
    assert.equal(result.unknownRuntimeCount, 8);
    assert.equal(result.totalWatches, 9);
    assert.ok(Number.isFinite(result.knownRuntimeMinutes));
});

test('invalid calendar dates are ignored, including invalid century leap days', () => {
    const invalid = ['1900-02-29', '2025-02-29', '2026-09-31', '2026-00-01', '2026-13-01',
        '2026-01-00', '2026-9-01', '2026-09-01T00:00:00Z', '1899-12-31', '0000-01-01'];
    const result = journalInsights([
        entry('leap', {watchedOn: '2000-02-29'}),
        entry('leap2024', {watchedOn: '2024-02-29'}),
        ...invalid.map((watchedOn, index) => entry(`invalid-${index}`, {watchedOn})),
    ]);
    assert.equal(result.totalWatches, 2);
    for (const month of ['', '2026-0', '2026-00', '2026-13', '0000-01', '2026-09-01']) {
        assert.equal(journalInsights([entry('one')], month).totalWatches, 0);
    }
});

test('a moved or deleted duplicate is resolved before selecting the month', () => {
    const rows = [
        entry('moved', {watchedOn: '2026-08-01', updatedAt: 10}),
        entry('moved', {watchedOn: '2026-09-01', updatedAt: 20}),
        entry('deleted', {watchedOn: '2026-08-02', updatedAt: 10}),
        entry('deleted', {watchedOn: '2026-08-02', updatedAt: 10, deletedAt: 30}),
    ];
    assert.equal(journalInsights(rows, '2026-08').totalWatches, 0);
    assert.equal(journalInsights(rows, '2026-09').totalWatches, 1);
    assert.deepEqual(journalInsights(rows), journalInsights([...rows].reverse()));
});

test('deletion wins a revision tie, and same-version edits resolve independently of input order', () => {
    const rows = [
        entry('removed', {rating: 10}),
        entry('removed', {rating: 10, deletedAt: 100}),
        entry('changed', {rating: 8}),
        entry('changed', {rating: 2}),
    ];
    const result = journalInsights(rows);
    assert.equal(result.totalWatches, 1);
    assert.equal(result.ratedWatches, 1);
    assert.deepEqual(result, journalInsights([...rows].reverse()));
});

test('a latest unrated watch does not invent or erase the latest explicit personal rating', () => {
    const rows = [entry('rated', {rating: 7}), entry('unrated', {watchedOn: '2026-09-20'})];
    const result = journalInsights(rows);
    assert.equal(result.topRated[0].rating, 3.5);
    assert.equal(result.topRated[0].watches, 2);
    assert.equal(result.ratedWatches, 1);
});

test('a twelve-month trend includes empty gaps without changing all-time totals', () => {
    const result = journalInsights([
        entry('older', {watchedOn: '2024-01-01'}),
        entry('june', {watchedOn: '2026-06-01'}),
        entry('september', {watchedOn: '2026-09-01'}),
    ]);
    assert.equal(result.totalWatches, 3);
    assert.equal(result.months.length, 12);
    assert.equal(result.monthsTruncated, true);
    assert.deepEqual(result.months[0], {month: '2025-10', count: 0});
    assert.deepEqual(result.months[8], {month: '2026-06', count: 1});
    assert.deepEqual(result.months[11], {month: '2026-09', count: 1});
    assert.equal(result.months.reduce((total, month) => total + month.count, 0), 2);
    const short = journalInsights([entry('july', {watchedOn: '2026-07-01'}), entry('september')]);
    assert.deepEqual(short.months, [{month: '2026-07', count: 1}, {month: '2026-08', count: 0}, {month: '2026-09', count: 1}]);
    assert.equal(short.monthsTruncated, false);
});

test('ranked lists have stable ties and five items at most', () => {
    const rows = ['Zulu', 'Echo', 'Charlie', 'Bravo', 'Alpha', 'Delta'].map((title, index) =>
        entry(`entry-${index}`, {movie: movie({id: index + 1, title, genres: [title]}), rating: 9}));
    const result = journalInsights(rows);
    assert.deepEqual(result.topRated.map(item => item.movie.title), ['Alpha', 'Bravo', 'Charlie', 'Delta', 'Echo']);
    assert.deepEqual(result.topGenres.map(item => item.name), ['Alpha', 'Bravo', 'Charlie', 'Delta', 'Echo']);
    assert.deepEqual(result, journalInsights([...rows].reverse()));
});

test('malformed records and oversized unexpected arrays cannot contaminate insights', () => {
    const bad = [null, [], {}, entry('__proto__'), entry('constructor'),
        entry('invalid-time', {updatedAt: NaN}), entry('invalid-delete', {deletedAt: Infinity}),
        entry('no-movie', {movie: null as unknown as JournalMovie}),
        entry('bad-id', {movie: movie({id: NaN})}), entry('large-title', {movie: movie({title: 'x'.repeat(301)})})];
    const result = journalInsights(bad as JournalEntry[]);
    assert.deepEqual(result, journalInsights([]));
    assert.deepEqual(journalInsights(null as unknown as JournalEntry[]), journalInsights([]));
    const tooMany = journalInsights(Array(10001).fill(entry('one')));
    assert.equal(tooMany.entriesTruncated, true);
    assert.equal(tooMany.totalWatches, 0);
});

test('snapshots omit unsafe image URLs and do not mutate or retain mutable input fields', () => {
    const source = entry('one', {rating: 10, movie: movie({posterUrl: 'javascript:alert(1)', genres: ['Drama', ' Drama ']})});
    const before = structuredClone(source);
    const result = journalInsights([source]);
    assert.deepEqual(source, before);
    assert.equal(result.topRated[0].movie.posterUrl, null);
    result.topRated[0].movie.genres.push('Comedy');
    assert.deepEqual(source.movie.genres, before.movie.genres);
});
