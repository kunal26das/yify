import type {Movie} from '../entities/Movie';
import type {NotificationPreferences} from '../entities/NotificationPreferences';
import type {NewMoviesNotification} from './newMoviesNotification';
import {quietHoursEndAt} from './newMoviesNotification';

const MAX_DAYS = 7;
const MAX_CANDIDATES = 1000;
const MAX_EXCLUSIONS = 4000;
const MAX_TITLE_LENGTH = 120;

export interface DailyMoviePick {
    identifier: string;
    date: Date;
    movieId: number;
    content: NewMoviesNotification;
}

export interface DailyMoviePicksInput {
    now: Date;
    preferences: NotificationPreferences;
    movies: Movie[];
    watchlist: Movie[];
    excludedIds?: number[];
    recentIds?: number[];
    lastActiveDate?: string;
    days?: number;
}

interface Candidate {
    id: number;
    title: string;
    rating: number;
    genres: string[];
}

export function localNotificationDateKey(date: Date): string {
    if (!(date instanceof Date) || !Number.isFinite(date.getTime())) return '';
    const year = date.getFullYear();
    if (year < 1 || year > 9999) return '';
    return `${String(year).padStart(4, '0')}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function validId(id: unknown): id is number {
    return typeof id === 'number' && Number.isSafeInteger(id) && id > 0 && id <= 2_147_483_647;
}

function genreName(value: unknown): string {
    return typeof value === 'string' ? value.slice(0, 64).trim().toLowerCase() : '';
}

function displayGenre(value: string | undefined): string | null {
    if (!value || !/^[a-z][a-z -]{0,31}$/.test(value)) return null;
    return value.replace(/(^|[ -])[a-z]/g, (letter) => letter.toUpperCase());
}

function candidates(movies: Movie[]): Candidate[] {
    const result: Candidate[] = [];
    const seen = new Set<number>();
    if (!Array.isArray(movies)) return result;
    for (const movie of movies.slice(0, MAX_CANDIDATES)) {
        if (!movie || !validId(movie.id) || seen.has(movie.id) || typeof movie.title !== 'string') continue;
        const title = Array.from(movie.title.slice(0, 1024)
            .replace(/[\u0000-\u001f\u007f-\u009f\u200b-\u200f\u202a-\u202e\u2060-\u206f]/g, ' ')
            .replace(/\s+/g, ' ').trim()).slice(0, MAX_TITLE_LENGTH).join('');
        if (!title) continue;
        seen.add(movie.id);
        const rating = Number.isFinite(movie.rating) && movie.rating >= 0 && movie.rating <= 10 ? movie.rating : 0;
        const genres = Array.isArray(movie.genres)
            ? [...new Set(movie.genres.slice(0, 20).map(genreName).filter(Boolean))] : [];
        result.push({id: movie.id, title, rating, genres});
    }
    return result;
}

function hour(value: number, fallback: number): number {
    return Number.isInteger(value) && value >= 0 && value <= 23 ? value : fallback;
}

export function buildDailyMoviePicks({
    now,
    preferences,
    movies,
    watchlist,
    excludedIds = [],
    recentIds = [],
    lastActiveDate,
    days = MAX_DAYS,
}: DailyMoviePicksInput): DailyMoviePick[] {
    if (!localNotificationDateKey(now) || preferences.dailyPicks === false) return [];
    const limit = Number.isFinite(days) ? Math.max(0, Math.min(MAX_DAYS, Math.floor(days))) : MAX_DAYS;
    if (limit === 0) return [];
    if ([excludedIds, recentIds].some((ids) => Array.isArray(ids) && ids.length > MAX_EXCLUSIONS)) return [];
    const excluded = new Set([excludedIds, recentIds].flatMap((ids) => Array.isArray(ids)
        ? ids.slice(0, MAX_EXCLUSIONS).filter(validId) : []));
    const saved = candidates(watchlist);
    const savedIds = new Set(saved.map((movie) => movie.id));
    const preferredGenres = new Map<string, number>();
    for (const movie of saved) {
        for (const genre of movie.genres) preferredGenres.set(genre, (preferredGenres.get(genre) ?? 0) + 1);
    }
    const genre = genreName(preferences.genre);
    const minimumRating = Number.isFinite(preferences.minimumRating)
        ? Math.max(0, Math.min(10, preferences.minimumRating)) : 0;
    const eligible = (movie: Candidate) => !excluded.has(movie.id) && movie.rating >= minimumRating &&
        (!genre || movie.genres.includes(genre));
    const affinity = (movie: Candidate) => genre ? 0 : movie.genres.reduce((sum, item) => sum + (preferredGenres.get(item) ?? 0), 0);
    const rank = (a: Candidate, b: Candidate) => affinity(b) - affinity(a) || b.rating - a.rating || a.id - b.id;
    const savedPicks = saved.filter(eligible).sort(rank);
    const discoveries = candidates(movies).filter((movie) => !savedIds.has(movie.id) && eligible(movie)).sort(rank);
    const dailyHour = hour(preferences.dailyHour, 19);
    const quietStart = hour(preferences.quietStartHour, 22);
    const quietEnd = hour(preferences.quietEndHour, 8);
    const result: DailyMoviePick[] = [];
    const dates = new Set<string>();
    for (let offset = 0; offset <= MAX_DAYS + 2 && result.length < limit; offset++) {
        const requested = new Date(now.getTime());
        requested.setDate(now.getDate() + offset);
        requested.setHours(dailyHour, 0, 0, 0);
        const date = preferences.quietHours ? quietHoursEndAt(requested, quietStart, quietEnd) ?? requested : requested;
        const dateKey = localNotificationDateKey(date);
        if (!dateKey || date.getTime() <= now.getTime() || dateKey === lastActiveDate || dates.has(dateKey)) continue;
        const preferred = result.length % 2 === 0 ? savedPicks : discoveries;
        const fallback = preferred === savedPicks ? discoveries : savedPicks;
        const movie = preferred.shift() ?? fallback.shift();
        if (!movie) break;
        const fromWatchlist = savedIds.has(movie.id);
        const facts = [
            movie.rating > 0 ? `${movie.rating.toFixed(1)}/10` : null,
            displayGenre(movie.genres.find((value) => value === genre) ?? movie.genres[0]),
        ].filter(Boolean);
        result.push({
            identifier: `yify-daily-pick:${dateKey}`,
            date,
            movieId: movie.id,
            content: {
                title: fromWatchlist ? 'One from your Watchlist' : 'Your next movie?',
                body: `${[movie.title, ...facts].join(' · ')}. Take a closer look.`,
                data: {movieId: movie.id, kind: 'daily-pick', dateKey},
            },
        });
        dates.add(dateKey);
    }
    return result;
}
