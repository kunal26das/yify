import assert from 'node:assert/strict';
import test from 'node:test';
import {createRequire} from 'node:module';
import type {Movie} from '../entities/Movie.ts';
import type {LibraryState} from '../entities/LibraryState.ts';

const require = createRequire(import.meta.url);
const {loadTypeScript} = require('../../tests/helpers/load-typescript.cjs');
const {selectWatchlistMovies, pickWatchlistMovie} = loadTypeScript('domain/policies/watchlistView.ts');

function movie(id: number, title: string, extra: Partial<Movie> = {}): Movie {
    return {id, title, titleLong: title, imdbCode: `tt${id}`, year: 2020, rating: 7,
        runtimeMinutes: 100, genres: ['Drama'], summary: '', language: 'en', mpaRating: '', posterUrls: [], ...extra};
}

const movies = [
    movie(1, 'Zulu', {year: 2010, rating: 8, runtimeMinutes: 80}),
    movie(2, 'Amélie', {year: 2001, rating: 9, runtimeMinutes: 122}),
    movie(3, 'Bright', {year: 2026, genres: ['Comedy'], runtimeMinutes: 90}),
    movie(4, 'Unknown length', {runtimeMinutes: 0}),
];
const library: LibraryState = {
    clearedAt: 0,
    watched: {'2': {at: 10, value: true}, '3': {at: 11, value: false}},
    collections: {weekend: {name: 'Weekend', updatedAt: 10, removedAt: 0}},
    memberships: {weekend: {'1': {at: 12, value: true}, '2': {at: 13, value: true}, '3': {at: 14, value: false}}},
};
const ids = (items: Movie[]) => items.map((item) => item.id);

test('search, explicit watched status, genre, runtime and collection filters compose', () => {
    assert.deepEqual(ids(selectWatchlistMovies(movies, library, {query: '  AMELIE '})), [2]);
    assert.deepEqual(ids(selectWatchlistMovies(movies, library, {status: 'watched'})), [2]);
    assert.deepEqual(ids(selectWatchlistMovies(movies, library, {status: 'to-watch', collectionId: 'weekend', genre: 'drama', maxRuntimeMinutes: 90})), [1]);
    assert.deepEqual(ids(selectWatchlistMovies(movies, library, {genre: 'Comedy', collectionId: 'weekend'})), []);
    assert.deepEqual(ids(selectWatchlistMovies(movies, library, {maxRuntimeMinutes: 90})), [1, 3]);
});

test('saved order is preserved, sorting is stable and never mutates saved data', () => {
    const original = [...movies];
    assert.deepEqual(ids(selectWatchlistMovies(movies, library)), [1, 2, 3, 4]);
    assert.deepEqual(ids(selectWatchlistMovies(movies, library, {sort: 'title'})), [2, 3, 4, 1]);
    assert.deepEqual(ids(selectWatchlistMovies(movies, library, {sort: 'rating'})), [2, 1, 3, 4]);
    assert.deepEqual(ids(selectWatchlistMovies(movies, library, {sort: 'year'})), [3, 4, 1, 2]);
    assert.deepEqual(movies, original);
});

test('cleared watched marks and deleted collections cannot leak into the visible selection', () => {
    assert.deepEqual(ids(selectWatchlistMovies(movies, {...library, clearedAt: 20}, {status: 'watched'})), []);
    assert.deepEqual(ids(selectWatchlistMovies(movies, library, {collectionId: 'missing'})), []);
    const removed = {...library, collections: {weekend: {...library.collections.weekend, removedAt: 30}}};
    assert.deepEqual(selectWatchlistMovies(movies, removed, {collectionId: 'weekend'}), []);
});

test('picker only chooses matching unwatched movies and handles empty or fully watched filters', () => {
    assert.equal(pickWatchlistMovie(movies, library, {collectionId: 'weekend'}, () => 0.99)?.id, 1);
    assert.equal(pickWatchlistMovie(movies, library, {genre: 'Comedy'}, () => 0)?.id, 3);
    assert.equal(pickWatchlistMovie(movies, library, {status: 'watched'}, () => 0), undefined);
    assert.equal(pickWatchlistMovie(movies, library, {query: 'no such title'}, () => 0), undefined);
    assert.equal(pickWatchlistMovie([], library), undefined);
});

test('picker supports both ends of its candidate set without falling outside the list', () => {
    assert.equal(pickWatchlistMovie(movies, library, {}, () => 0)?.id, 1);
    assert.equal(pickWatchlistMovie(movies, library, {}, () => 0.999)?.id, 4);
    assert.equal(pickWatchlistMovie(movies, library, {}, () => 1)?.id, 4);
});
