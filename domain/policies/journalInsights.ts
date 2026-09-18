import type {JournalEntry, JournalMovie} from '../entities/Journal';

const MAX_INPUT_ENTRIES = 10000;
const TREND_MONTHS = 12;
const TOP_ITEMS = 5;

export interface JournalInsights {
    totalWatches: number;
    distinctMovies: number;
    repeatWatches: number;
    ratedWatches: number;
    /** Mean of rated viewings, in stars (0.5–5), without presentation rounding. */
    averageRating: number | null;
    /** Sum of known movie runtimes for logged viewings; this is not measured playback. */
    knownRuntimeMinutes: number;
    unknownRuntimeCount: number;
    /** A viewing can contribute to several genres, but only once to each genre. */
    topGenres: {name: string; count: number}[];
    /** At most 12 calendar months, oldest first; gaps inside the window have zero counts. */
    months: {month: string; count: number}[];
    monthsTruncated: boolean;
    /** Latest rated viewing per movie within the selected period, expressed in stars. */
    topRated: {movie: JournalMovie; rating: number; watches: number}[];
    /** Oversized unexpected inputs are rejected rather than presented as complete totals. */
    entriesTruncated: boolean;
}

type Candidate = {
    id: string;
    version: number;
    deleted: boolean;
    entry: JournalEntry | null;
    tie: string;
};

function emptyInsights(entriesTruncated = false): JournalInsights {
    return {
        totalWatches: 0, distinctMovies: 0, repeatWatches: 0, ratedWatches: 0,
        averageRating: null, knownRuntimeMinutes: 0, unknownRuntimeCount: 0,
        topGenres: [], months: [], monthsTruncated: false, topRated: [], entriesTruncated,
    };
}

function record(value: unknown): Record<string, unknown> | null {
    return value !== null && typeof value === 'object' && !Array.isArray(value)
        ? value as Record<string, unknown> : null;
}

function compare(a: string, b: string): number {
    return a < b ? -1 : a > b ? 1 : 0;
}

function text(value: unknown, limit: number): string | null {
    if (typeof value !== 'string' || value.length > limit || /[\u0000-\u001f\u007f]/.test(value)) return null;
    return value.trim().replace(/\s+/g, ' ') || null;
}

function integer(value: unknown, minimum: number, maximum: number): value is number {
    return typeof value === 'number' && Number.isSafeInteger(value) && value >= minimum && value <= maximum;
}

function monthIndex(value: string): number | null {
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(value) || value.startsWith('0000')) return null;
    return Number(value.slice(0, 4)) * 12 + Number(value.slice(5, 7)) - 1;
}

function calendarDate(value: unknown): value is string {
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value) || value < '1900-01-01') return false;
    if (monthIndex(value.slice(0, 7)) === null) return false;
    const year = Number(value.slice(0, 4));
    const month = Number(value.slice(5, 7));
    const day = Number(value.slice(8, 10));
    const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
    const days = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
    return day >= 1 && day <= days[month - 1];
}

function monthLabel(index: number): string {
    return `${String(Math.floor(index / 12)).padStart(4, '0')}-${String(index % 12 + 1).padStart(2, '0')}`;
}

function movieSnapshot(value: unknown): JournalMovie | null {
    const raw = record(value);
    if (!raw || !integer(raw.id, 1, Number.MAX_SAFE_INTEGER)) return null;
    const title = text(raw.title, 300);
    if (!title) return null;
    const genres = new Map<string, string>();
    if (Array.isArray(raw.genres)) {
        for (const value of raw.genres.slice(0, 20)) {
            const name = text(value, 60);
            if (!name) continue;
            const key = name.toLowerCase();
            const previous = genres.get(key);
            if (!previous || compare(name, previous) < 0) genres.set(key, name);
        }
    }
    let posterUrl: string | null = null;
    if (typeof raw.posterUrl === 'string' && raw.posterUrl.length <= 2048) {
        try {
            const url = new URL(raw.posterUrl);
            if (url.protocol === 'https:' && !url.username && !url.password) posterUrl = url.href;
        } catch {}
    }
    return {
        id: raw.id, title, year: integer(raw.year, 0, 9999) ? raw.year : 0,
        runtimeMinutes: integer(raw.runtimeMinutes, 1, 1440) ? raw.runtimeMinutes : 0,
        genres: [...genres.values()].sort(compare), posterUrl,
    };
}

function candidate(value: unknown): Candidate | null {
    const raw = record(value);
    if (!raw || typeof raw.id !== 'string' || !/^[A-Za-z0-9_-]{1,100}$/.test(raw.id) ||
        ['__proto__', 'constructor', 'prototype'].includes(raw.id) ||
        !integer(raw.updatedAt, 1, Number.MAX_SAFE_INTEGER) ||
        !integer(raw.deletedAt, 0, Number.MAX_SAFE_INTEGER)) return null;
    const version = Math.max(raw.updatedAt, raw.deletedAt);
    if (raw.deletedAt > 0) return {id: raw.id, version, deleted: true, entry: null, tie: ''};
    const movie = movieSnapshot(raw.movie);
    if (!movie || !calendarDate(raw.watchedOn)) return null;
    const entry: JournalEntry = {
        id: raw.id, movie, watchedOn: raw.watchedOn,
        rating: integer(raw.rating, 1, 10) ? raw.rating : null,
        note: '', updatedAt: raw.updatedAt, deletedAt: 0,
    };
    return {id: raw.id, version, deleted: false, entry, tie: JSON.stringify(entry)};
}

function latestViewing(a: JournalEntry, b: JournalEntry): number {
    return compare(a.watchedOn, b.watchedOn) || a.updatedAt - b.updatedAt || compare(a.id, b.id);
}

/** Derive insights only from explicitly dated journal entries, never from browsing or watched marks. */
export function journalInsights(entries: readonly JournalEntry[], period?: string): JournalInsights {
    const result = emptyInsights();
    if (period !== undefined && (typeof period !== 'string' || monthIndex(period) === null)) return result;
    if (!Array.isArray(entries)) return result;
    if (entries.length > MAX_INPUT_ENTRIES) return emptyInsights(true);

    // Resolve revisions before filtering by month so an edited date or a deletion cannot revive an old entry.
    const revisions = new Map<string, Candidate>();
    for (const value of entries) {
        const next = candidate(value);
        if (!next) continue;
        const previous = revisions.get(next.id);
        if (!previous || next.version > previous.version || (next.version === previous.version &&
            (Number(next.deleted) > Number(previous.deleted) ||
                (next.deleted === previous.deleted && compare(next.tie, previous.tie) > 0)))) {
            revisions.set(next.id, next);
        }
    }

    const movieCounts = new Map<number, number>();
    const ratings = new Map<number, JournalEntry>();
    const genres = new Map<string, {name: string; count: number}>();
    const monthCounts = new Map<string, number>();
    let ratingTotal = 0;
    for (const revision of revisions.values()) {
        const entry = revision.entry;
        if (!entry || (period !== undefined && entry.watchedOn.slice(0, 7) !== period)) continue;
        result.totalWatches++;
        movieCounts.set(entry.movie.id, (movieCounts.get(entry.movie.id) ?? 0) + 1);
        const month = entry.watchedOn.slice(0, 7);
        monthCounts.set(month, (monthCounts.get(month) ?? 0) + 1);
        if (entry.movie.runtimeMinutes > 0) result.knownRuntimeMinutes += entry.movie.runtimeMinutes;
        else result.unknownRuntimeCount++;
        if (entry.rating !== null) {
            result.ratedWatches++;
            ratingTotal += entry.rating;
            const previous = ratings.get(entry.movie.id);
            if (!previous || latestViewing(entry, previous) > 0) ratings.set(entry.movie.id, entry);
        }
        for (const name of entry.movie.genres) {
            const key = name.toLowerCase();
            const previous = genres.get(key);
            genres.set(key, {name: previous && compare(previous.name, name) < 0 ? previous.name : name,
                count: (previous?.count ?? 0) + 1});
        }
    }
    result.distinctMovies = movieCounts.size;
    result.repeatWatches = result.totalWatches - result.distinctMovies;
    result.averageRating = result.ratedWatches ? ratingTotal / result.ratedWatches / 2 : null;
    result.topGenres = [...genres.values()].sort((a, b) => b.count - a.count || compare(a.name, b.name)).slice(0, TOP_ITEMS);
    result.topRated = [...ratings.values()].sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0) ||
        compare(a.movie.title.toLowerCase(), b.movie.title.toLowerCase()) || a.movie.id - b.movie.id)
        .slice(0, TOP_ITEMS).map((entry) => ({movie: entry.movie, rating: entry.rating! / 2, watches: movieCounts.get(entry.movie.id)!}));

    const monthKeys = [...monthCounts.keys()].sort(compare);
    if (monthKeys.length > 0) {
        const first = monthIndex(monthKeys[0])!;
        const last = monthIndex(monthKeys[monthKeys.length - 1])!;
        const start = Math.max(first, last - TREND_MONTHS + 1);
        result.monthsTruncated = start > first;
        for (let index = start; index <= last; index++) {
            const month = monthLabel(index);
            result.months.push({month, count: monthCounts.get(month) ?? 0});
        }
    }
    return result;
}
