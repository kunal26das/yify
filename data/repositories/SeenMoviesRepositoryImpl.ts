import type {KeyValueStore, SeenMoviesRepository} from '@/domain';

const CACHE_KEY = 'cached-ids';
const LAST_RUN_KEY = 'last-run-date';

export class SeenMoviesRepositoryImpl implements SeenMoviesRepository {
    private readonly store: KeyValueStore;

    constructor(store: KeyValueStore) {
        this.store = store;
    }

    getSeenIds(): Set<number> {
        const raw = this.store.getString(CACHE_KEY);
        if (!raw) return new Set();
        try {
            return new Set(JSON.parse(raw) as number[]);
        } catch {
            return new Set();
        }
    }

    setSeenIds(ids: Iterable<number>): void {
        this.store.set(CACHE_KEY, JSON.stringify([...ids]));
    }

    getLastRunDate(): string | undefined {
        return this.store.getString(LAST_RUN_KEY);
    }

    setLastRunDate(date: string): void {
        this.store.set(LAST_RUN_KEY, date);
    }
}
