import type {KeyValueStore} from './storage/key-value-store';

const CACHE_KEY = 'cached-ids';
const LAST_RUN_KEY = 'last-run-date';

export class NewMoviesCache {
    constructor(private readonly store: KeyValueStore) {
    }

    getCachedIds(): Set<number> {
        const raw = this.store.getString(CACHE_KEY);
        if (!raw) return new Set();
        try {
            return new Set(JSON.parse(raw) as number[]);
        } catch {
            return new Set();
        }
    }

    setCachedIds(ids: Iterable<number>): void {
        this.store.set(CACHE_KEY, JSON.stringify([...ids]));
    }

    getLastRunDate(): string | undefined {
        return this.store.getString(LAST_RUN_KEY);
    }

    setLastRunDate(date: string): void {
        this.store.set(LAST_RUN_KEY, date);
    }
}
