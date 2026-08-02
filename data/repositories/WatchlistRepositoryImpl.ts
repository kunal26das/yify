import type {KeyValueStore, Movie, WatchlistRepository} from '@/domain';

const KEY = 'items';

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
        ytTrailerCode: m.ytTrailerCode,
        thumbnailUrls: m.thumbnailUrls,
    };
}

export class WatchlistRepositoryImpl implements WatchlistRepository {
    private readonly store: KeyValueStore;
    private readonly listeners = new Set<() => void>();
    private snapshot: Movie[] | null = null;

    constructor(store: KeyValueStore) {
        this.store = store;
    }

    getAll(): Movie[] {
        return this.read();
    }

    contains(id: number): boolean {
        return this.read().some((m) => m.id === id);
    }

    add(movie: Movie): void {
        const items = this.read();
        if (items.some((m) => m.id === movie.id)) return;
        this.write([toWatchlistMovie(movie), ...items]);
    }

    remove(id: number): void {
        const items = this.read();
        if (!items.some((m) => m.id === id)) return;
        this.write(items.filter((m) => m.id !== id));
    }

    toggle(movie: Movie): boolean {
        if (this.contains(movie.id)) {
            this.remove(movie.id);
            return false;
        }
        this.add(movie);
        return true;
    }

    clear(): void {
        if (this.read().length === 0) return;
        this.write([]);
    }

    applyRemote(items: Movie[]): void {
        this.write(items.map(toWatchlistMovie));
    }

    subscribe(listener: () => void): () => void {
        this.listeners.add(listener);
        return () => {
            this.listeners.delete(listener);
        };
    }

    private read(): Movie[] {
        if (this.snapshot) return this.snapshot;
        const raw = this.store.getString(KEY);
        if (!raw) {
            this.snapshot = [];
            return this.snapshot;
        }
        try {
            const parsed = JSON.parse(raw) as Movie[];
            this.snapshot = Array.isArray(parsed) ? parsed : [];
        } catch {
            this.snapshot = [];
        }
        return this.snapshot;
    }

    private write(next: Movie[]): void {
        this.snapshot = next;
        this.store.set(KEY, JSON.stringify(next));
        this.listeners.forEach((listener) => listener());
    }
}
