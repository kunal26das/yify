import assert from 'node:assert/strict';
import test from 'node:test';

import type {HistoryEntry} from '../entities/HistoryEntry.ts';
import type {Movie} from '../entities/Movie.ts';
import type {Show} from '../entities/Show.ts';
import {
    filterHistory,
    groupHistory,
    historyGroupLabel,
    historyHref,
    historyKind,
    movieHistoryEntry,
    movieHistoryKey,
    showHistoryEntry,
    showHistoryKey,
} from './historyView.ts';

const NOW = new Date(2026, 8, 1, 12, 0).getTime();

function at(year: number, month: number, day: number, hour = 9): number {
    return new Date(year, month, day, hour).getTime();
}

function entry(key: string, watchedAt: number, title = key): HistoryEntry {
    return {key, title, watchedAt};
}

function movie(overrides: Partial<Movie> = {}): Movie {
    return {
        id: 42,
        imdbCode: 'tt0042',
        title: 'Inception',
        titleLong: 'Inception (2010)',
        year: 2010,
        rating: 8.8,
        runtimeMinutes: 148,
        genres: ['Action'],
        summary: 'A summary',
        language: 'en',
        mpaRating: 'PG-13',
        posterUrls: ['poster-small.jpg', 'poster-large.jpg'],
        ...overrides,
    };
}

function show(overrides: Partial<Show> = {}): Show {
    return {
        imdbId: 'tt0903747',
        imdbCode: 'tt0903747',
        title: 'Breaking Bad',
        episodeCount: 62,
        latestEpisode: {
            id: 1,
            title: 'Felina',
            season: 5,
            episode: 16,
            seeds: 10,
            peers: 2,
            sizeBytes: 1,
            magnetUrl: 'magnet:?x',
            releasedAt: new Date(2013, 8, 29),
        },
        updatedAt: new Date(2013, 8, 29),
        ...overrides,
    };
}

test('keys carry the kind so a row knows where it links', () => {
    assert.equal(movieHistoryKey(42), 'movie:42');
    assert.equal(showHistoryKey('tt0903747'), 'show:tt0903747');
    assert.equal(historyKind('movie:42'), 'movie');
    assert.equal(historyKind('show:tt0903747'), 'show');
    assert.equal(historyHref('movie:42'), '/movie/42');
    assert.equal(historyHref('show:tt0903747'), '/show/tt0903747');
});

test('a movie entry keeps only what a history row renders', () => {
    assert.deepEqual(movieHistoryEntry(movie(), 500), {
        key: 'movie:42',
        title: 'Inception',
        watchedAt: 500,
        imageUrl: 'poster-large.jpg',
        year: 2010,
        rating: 8.8,
        runtimeMinutes: 148,
    });
});

test('a movie entry prefers a thumbnail, then the backdrop, then the largest poster', () => {
    assert.equal(
        movieHistoryEntry(movie({thumbnailUrls: ['thumb.jpg'], backgroundImageUrl: 'bg.jpg'}), 1)
            .imageUrl,
        'thumb.jpg'
    );
    assert.equal(
        movieHistoryEntry(movie({backgroundImageUrl: 'bg.jpg'}), 1).imageUrl,
        'bg.jpg'
    );
    assert.equal(movieHistoryEntry(movie({posterUrls: []}), 1).imageUrl, undefined);
});

test('a movie entry omits empty metadata rather than storing zeroes', () => {
    const lean = movieHistoryEntry(movie({year: 0, rating: 0, runtimeMinutes: 0}), 1);
    assert.deepEqual(Object.keys(lean).sort(), ['imageUrl', 'key', 'title', 'watchedAt']);
});

test('a show entry is keyed by its imdb id', () => {
    assert.deepEqual(showHistoryEntry(show({thumbnailUrl: 'show.jpg'}), 700), {
        key: 'show:tt0903747',
        title: 'Breaking Bad',
        watchedAt: 700,
        imageUrl: 'show.jpg',
    });
});

test('today is labelled Today', () => {
    assert.equal(historyGroupLabel(at(2026, 8, 1, 0), NOW), 'Today');
    assert.equal(historyGroupLabel(at(2026, 8, 1, 23), NOW), 'Today');
});

test('a timestamp from the future is still Today', () => {
    assert.equal(historyGroupLabel(at(2026, 8, 4), NOW), 'Today');
});

test('a timestamp outside the representable date range does not render as undefined NaN', () => {
    assert.equal(historyGroupLabel(1e18, NOW), 'Today');
    assert.equal(historyGroupLabel(-1e16, NOW), 'Today');
    assert.equal(historyGroupLabel(Number.MAX_SAFE_INTEGER, NOW), 'Today');
});

test('the past week is labelled by weekday, with no Yesterday', () => {
    assert.equal(historyGroupLabel(at(2026, 7, 31), NOW), 'Monday');
    assert.equal(historyGroupLabel(at(2026, 7, 30), NOW), 'Sunday');
    assert.equal(historyGroupLabel(at(2026, 7, 26), NOW), 'Wednesday');
});

test('a week back switches to a month and day', () => {
    assert.equal(historyGroupLabel(at(2026, 7, 25), NOW), 'Aug 25');
    assert.equal(historyGroupLabel(at(2026, 0, 3), NOW), 'Jan 3');
});

test('an earlier year carries the year', () => {
    assert.equal(historyGroupLabel(at(2025, 11, 31), NOW), 'Dec 31, 2025');
});

test('grouping buckets consecutive entries under one heading', () => {
    const groups = groupHistory(
        [
            entry('movie:1', at(2026, 8, 1, 11)),
            entry('movie:2', at(2026, 8, 1, 9)),
            entry('movie:3', at(2026, 7, 31)),
            entry('movie:4', at(2026, 7, 25)),
        ],
        NOW
    );
    assert.deepEqual(
        groups.map((group) => [group.label, group.entries.length]),
        [
            ['Today', 2],
            ['Monday', 1],
            ['Aug 25', 1],
        ]
    );
});

test('grouping an empty history yields no headings', () => {
    assert.deepEqual(groupHistory([], NOW), []);
});

test('filtering by kind splits movies from shows', () => {
    const entries = [entry('movie:1', 10, 'Dune'), entry('show:tt1', 20, 'Severance')];
    assert.deepEqual(filterHistory(entries, {kind: 'movie'}), [entries[0]]);
    assert.deepEqual(filterHistory(entries, {kind: 'show'}), [entries[1]]);
    assert.deepEqual(filterHistory(entries, {kind: 'all'}), entries);
    assert.deepEqual(filterHistory(entries, {}), entries);
});

test('searching matches titles case-insensitively anywhere in the title', () => {
    const entries = [entry('movie:1', 10, 'Dune: Part Two'), entry('movie:2', 20, 'Sinners')];
    assert.deepEqual(filterHistory(entries, {query: 'part'}), [entries[0]]);
    assert.deepEqual(filterHistory(entries, {query: 'SIN'}), [entries[1]]);
    assert.deepEqual(filterHistory(entries, {query: '   '}), entries);
    assert.deepEqual(filterHistory(entries, {query: 'nothing'}), []);
});

test('search and kind filters compose', () => {
    const entries = [entry('movie:1', 10, 'Dune'), entry('show:tt1', 20, 'Dune the series')];
    assert.deepEqual(filterHistory(entries, {query: 'dune', kind: 'show'}), [entries[1]]);
});
