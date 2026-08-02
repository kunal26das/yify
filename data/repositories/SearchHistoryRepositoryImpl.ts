import type {KeyValueStore, SearchHistoryRepository} from '@/domain';

const RECENTS_KEY = 'search.recents';
const RECENTS_LIMIT = 8;

export class SearchHistoryRepositoryImpl implements SearchHistoryRepository {
    private readonly store: KeyValueStore;

    constructor(store: KeyValueStore) {
        this.store = store;
    }

    getRecent(): string[] {
        return this.parse(this.store.getString(RECENTS_KEY));
    }

    remember(term: string): string[] {
        const trimmed = term.trim();
        if (!trimmed) return this.getRecent();
        const rest = this.getRecent().filter(
            (item) => item.toLowerCase() !== trimmed.toLowerCase()
        );
        return this.write([trimmed, ...rest].slice(0, RECENTS_LIMIT));
    }

    forget(term: string): string[] {
        return this.write(this.getRecent().filter((item) => item !== term));
    }

    clear(): void {
        this.write([]);
    }

    private write(next: string[]): string[] {
        this.store.set(RECENTS_KEY, JSON.stringify(next));
        return next;
    }

    private parse(raw: string | undefined): string[] {
        if (!raw) return [];
        try {
            const parsed: unknown = JSON.parse(raw);
            if (!Array.isArray(parsed)) return [];
            return parsed
                .filter((item): item is string => typeof item === 'string')
                .slice(0, RECENTS_LIMIT);
        } catch {
            return [];
        }
    }
}
