import type {Movie} from '@/domain';
import {createKeyValueStore} from './storage/create-key-value-store';
import type {KeyValueStore} from './storage/key-value-store';

const STORE_ID = 'watchlist';
const KEY = 'items';

let store: KeyValueStore | null = null;
function getStore(): KeyValueStore {
    if (!store) store = createKeyValueStore(STORE_ID);
    return store;
}

let snapshot: Movie[] | null = null;
const listeners = new Set<() => void>();

function read(): Movie[] {
    if (snapshot) return snapshot;
    const raw = getStore().getString(KEY);
    if (!raw) {
        snapshot = [];
        return snapshot;
    }
    try {
        const parsed = JSON.parse(raw) as Movie[];
        snapshot = Array.isArray(parsed) ? parsed : [];
    } catch {
        snapshot = [];
    }
    return snapshot;
}

function write(next: Movie[]): void {
    snapshot = next;
    getStore().set(KEY, JSON.stringify(next));
    listeners.forEach((listener) => listener());
}

function toWatchlistMovie(m: Movie): Movie {
    return {
        id: m.id,
        imdbCode: m.imdbCode,
        title: m.title,
        titleLong: m.titleLong,
        year: m.year,
        rating: m.rating,
        runtimeMinutes: m.runtimeMinutes,
        genres: m.genres,
        summary: m.summary,
        language: m.language,
        mpaRating: m.mpaRating,
        posterUrls: m.posterUrls,
        backgroundImageUrl: m.backgroundImageUrl,
    };
}

export function isInWatchlist(id: number): boolean {
    return read().some((m) => m.id === id);
}

export function addToWatchlist(movie: Movie): void {
    const items = read();
    if (items.some((m) => m.id === movie.id)) return;
    write([toWatchlistMovie(movie), ...items]);
}

export function removeFromWatchlist(id: number): void {
    const items = read();
    if (!items.some((m) => m.id === id)) return;
    write(items.filter((m) => m.id !== id));
}

export function toggleWatchlist(movie: Movie): boolean {
    if (isInWatchlist(movie.id)) {
        removeFromWatchlist(movie.id);
        return false;
    }
    addToWatchlist(movie);
    return true;
}

export function subscribeWatchlist(listener: () => void): () => void {
    listeners.add(listener);
    return () => {
        listeners.delete(listener);
    };
}

export function getWatchlistSnapshot(): Movie[] {
    return read();
}
