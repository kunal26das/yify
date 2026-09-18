import {trackSubscriptionFunnel, type AnalyticsSink, type KeyValueStore, type Movie, type SubscriptionFunnelContext, type WatchlistRepository} from '@/domain';

const KEY = 'items';
const MILESTONES_KEY = 'funnel_saved_milestones_v1';

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
    private ids = new Set<number>();

    constructor(store: KeyValueStore, private readonly analytics?: AnalyticsSink,
        private readonly funnelContext: () => SubscriptionFunnelContext = () => ({platform: 'other'})) {
        this.store = store;
    }

    getAll(): Movie[] {
        return this.read();
    }

    contains(id: number): boolean {
        this.read();
        return this.ids.has(id);
    }

    add(movie: Movie): void {
        const items = this.read();
        if (this.ids.has(movie.id)) return;
        this.write([toWatchlistMovie(movie), ...items]);
        this.trackMilestones(items.length, items.length + 1);
    }

    remove(id: number): void {
        const items = this.read();
        if (!this.ids.has(id)) return;
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

    private trackMilestones(before: number, after: number): void {
        if (!this.analytics) return;
        try {
            const saved: unknown = JSON.parse(this.store.getString(MILESTONES_KEY) ?? '[]');
            const recorded = new Set(Array.isArray(saved) ? saved.filter(value => value === 1 || value === 3) : []);
            for (const milestone of [1, 3] as const) {
                if (before >= milestone || after < milestone || recorded.has(milestone)) continue;
                recorded.add(milestone);
                this.store.set(MILESTONES_KEY, JSON.stringify([...recorded]));
                trackSubscriptionFunnel(this.analytics, {step: 'watchlist_milestone', milestone}, this.funnelContext());
            }
        } catch {}
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
            this.snapshot = Array.isArray(parsed)
                ? parsed.filter((movie) => movie != null && typeof movie === 'object' && Number.isSafeInteger(movie.id))
                    .map(toWatchlistMovie)
                : [];
            const projected = JSON.stringify(this.snapshot);
            if (projected !== raw) {
                try {
                    this.store.set(KEY, projected);
                } catch {}
            }
        } catch {
            this.snapshot = [];
        }
        this.ids = new Set(this.snapshot.map((movie) => movie.id));
        return this.snapshot;
    }

    private write(next: Movie[]): void {
        this.snapshot = next;
        this.ids = new Set(next.map((movie) => movie.id));
        this.store.set(KEY, JSON.stringify(next));
        this.listeners.forEach((listener) => listener());
    }
}
