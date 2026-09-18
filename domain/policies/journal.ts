import type {JournalData, JournalEntry, JournalInput, JournalMovie} from '../entities/Journal';
import type {Movie} from '../entities/Movie';

export const JOURNAL_MAX_ENTRIES = 500;
export const JOURNAL_MAX_NOTE_LENGTH = 1000;
export const JOURNAL_MAX_PAYLOAD_BYTES = 400000;
const ID = /^[a-zA-Z0-9_-]{1,100}$/;
const FORBIDDEN = new Set(['__proto__', 'constructor', 'prototype']);

export function emptyJournalData(): JournalData { return {entries: {}, clearedAt: 0}; }
function object(value: unknown): Record<string, unknown> {
    if (value == null || typeof value !== 'object' || Array.isArray(value)) throw new Error('Journal data could not be read.');
    return value as Record<string, unknown>;
}
function timestamp(value: unknown): value is number { return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0; }
function identifier(value: unknown): value is string { return typeof value === 'string' && ID.test(value) && !FORBIDDEN.has(value); }

/** Calculate UTF-8 size without relying on a browser-only TextEncoder. */
export function journalPayloadBytes(value: string): number {
    let bytes = 0;
    for (const character of value) {
        const code = character.codePointAt(0)!;
        bytes += code <= 0x7f ? 1 : code <= 0x7ff ? 2 : code <= 0xffff ? 3 : 4;
    }
    return bytes;
}

export function isJournalDate(value: unknown): value is string {
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value) || value < '1900-01-01') return false;
    const date = new Date(`${value}T12:00:00Z`);
    return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

export function journalToday(now = Date.now()): string {
    const date = new Date(now);
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function movieValue(value: unknown): JournalMovie {
    const movie = object(value);
    if (!Number.isSafeInteger(movie.id) || (movie.id as number) <= 0 ||
        typeof movie.title !== 'string' || !movie.title.trim() || movie.title.length > 300 ||
        !Number.isInteger(movie.year) || (movie.year as number) < 0 || (movie.year as number) > 9999 ||
        !Number.isInteger(movie.runtimeMinutes) || (movie.runtimeMinutes as number) < 0 || (movie.runtimeMinutes as number) > 1440 ||
        !Array.isArray(movie.genres) || movie.genres.length > 20 ||
        movie.genres.some(genre => typeof genre !== 'string' || !genre.trim() || genre.length > 60) ||
        (movie.posterUrl !== null && (typeof movie.posterUrl !== 'string' || movie.posterUrl.length > 2048 || !safePoster(movie.posterUrl)))) {
        throw new Error('Choose a valid movie for your journal.');
    }
    return {id: movie.id as number, title: movie.title.trim(), year: movie.year as number,
        runtimeMinutes: movie.runtimeMinutes as number, genres: [...new Set((movie.genres as string[]).map(genre => genre.trim()))],
        posterUrl: movie.posterUrl as string | null};
}

function safePoster(value: string): boolean {
    try { const url = new URL(value); return url.protocol === 'https:' && !url.username && !url.password; } catch { return false; }
}

export function projectJournalMovie(movie: Movie): JournalMovie {
    const poster = movie.posterUrls?.find(value => typeof value === 'string' && value.length <= 2048 && safePoster(value));
    return movieValue({id: movie.id, title: movie.title?.trim().slice(0, 300),
        year: Number.isInteger(movie.year) && movie.year >= 0 && movie.year <= 9999 ? movie.year : 0,
        runtimeMinutes: Number.isInteger(movie.runtimeMinutes) && movie.runtimeMinutes >= 0 && movie.runtimeMinutes <= 1440 ? movie.runtimeMinutes : 0,
        genres: (movie.genres ?? []).filter(value => typeof value === 'string' && value.trim()).slice(0, 20).map(value => value.trim().slice(0, 60)),
        posterUrl: poster ?? null});
}

export function validateJournalInput(input: JournalInput, now = Date.now()): JournalInput {
    if (input.id !== undefined && !identifier(input.id)) throw new Error('Choose a valid journal entry.');
    if (!isJournalDate(input.watchedOn) || input.watchedOn > journalToday(now)) throw new Error('Choose a valid watch date up to today.');
    if (input.rating !== null && (!Number.isInteger(input.rating) || input.rating < 1 || input.rating > 10)) throw new Error('Choose a rating from half a star to five stars.');
    if (typeof input.note !== 'string' || input.note.length > JOURNAL_MAX_NOTE_LENGTH) throw new Error(`Keep your note within ${JOURNAL_MAX_NOTE_LENGTH} characters.`);
    return {id: input.id, movie: movieValue(input.movie), watchedOn: input.watchedOn, rating: input.rating, note: input.note};
}

function normalizeData(value: unknown): JournalData {
    const data = object(value);
    if (!timestamp(data.clearedAt)) throw new Error('Journal data could not be read.');
    const entries: Record<string, JournalEntry> = {};
    const records = Object.entries(object(data.entries));
    if (records.length > JOURNAL_MAX_ENTRIES) throw new Error('Your journal has reached its storage limit.');
    for (const [id, raw] of records) {
        const entry = object(raw);
        if (!identifier(id) || entry.id !== id || !timestamp(entry.updatedAt) || entry.updatedAt === 0 ||
            !timestamp(entry.deletedAt) || !isJournalDate(entry.watchedOn) ||
            (entry.rating !== null && (!Number.isInteger(entry.rating) || (entry.rating as number) < 1 || (entry.rating as number) > 10)) ||
            typeof entry.note !== 'string' || entry.note.length > JOURNAL_MAX_NOTE_LENGTH) throw new Error('Journal data could not be read.');
        if (Math.max(entry.updatedAt, entry.deletedAt) <= data.clearedAt) continue;
        entries[id] = {id, movie: movieValue(entry.movie), watchedOn: entry.watchedOn,
            rating: entry.rating as number | null, note: entry.note, updatedAt: entry.updatedAt, deletedAt: entry.deletedAt};
    }
    return {entries, clearedAt: data.clearedAt};
}

export function encodeJournalData(data: JournalData): string {
    const normalized = normalizeData(data);
    const value = JSON.stringify({version: 1, clearedAt: normalized.clearedAt,
        entries: Object.fromEntries(Object.entries(normalized.entries).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0))});
    if (journalPayloadBytes(value) > JOURNAL_MAX_PAYLOAD_BYTES) throw new Error('Your journal has reached its storage limit.');
    return value;
}

export function parseJournalData(raw: string | undefined): JournalData {
    if (raw === undefined) return emptyJournalData();
    if (journalPayloadBytes(raw) > JOURNAL_MAX_PAYLOAD_BYTES) throw new Error('Your journal has reached its storage limit.');
    let value: unknown;
    try { value = JSON.parse(raw); } catch { throw new Error('Journal data could not be read.'); }
    if (object(value).version !== 1) throw new Error('Update Yify to read this journal.');
    return normalizeData(value);
}

function revision(entry: JournalEntry): number { return Math.max(entry.updatedAt, entry.deletedAt); }
export function mergeJournalData(a: JournalData, b: JournalData): JournalData {
    const entries = {...a.entries};
    for (const [id, next] of Object.entries(b.entries)) {
        const previous = entries[id];
        if (!previous || revision(next) > revision(previous) || (revision(next) === revision(previous) &&
            (next.deletedAt > previous.deletedAt || (next.deletedAt === previous.deletedAt && JSON.stringify(next) > JSON.stringify(previous))))) entries[id] = next;
    }
    const merged = normalizeData({entries, clearedAt: Math.max(a.clearedAt, b.clearedAt)});
    encodeJournalData(merged);
    return merged;
}

export function journalEntries(data: JournalData): JournalEntry[] {
    return Object.values(data.entries).filter(entry => entry.deletedAt === 0 && entry.updatedAt > data.clearedAt)
        .sort((a, b) => b.watchedOn.localeCompare(a.watchedOn) || b.updatedAt - a.updatedAt || a.id.localeCompare(b.id));
}

export function journalLatestTimestamp(data: JournalData): number {
    return Object.values(data.entries).reduce((latest, entry) => Math.max(latest, revision(entry)), data.clearedAt);
}
