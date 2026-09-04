import {
    clearHistory,
    encodeHistoryState,
    type HistoryEntry,
    type HistoryState,
    type KeyValueStore,
    liveHistory,
    parseHistoryState,
    recordHistory,
    removeHistory,
    type WatchHistoryRepository,
} from '@/domain';

const KEY = 'state';

export class WatchHistoryRepositoryImpl implements WatchHistoryRepository {
    private readonly store: KeyValueStore;
    private readonly listeners = new Set<() => void>();
    private state: HistoryState | null = null;
    private snapshot: HistoryEntry[] | null = null;

    constructor(store: KeyValueStore) {
        this.store = store;
    }

    getAll(): HistoryEntry[] {
        if (this.snapshot == null) this.snapshot = liveHistory(this.read());
        return this.snapshot;
    }

    getState(): HistoryState {
        return this.read();
    }

    record(entry: HistoryEntry): void {
        this.write(recordHistory(this.read(), entry));
    }

    remove(key: string): void {
        const current = this.read();
        const next = removeHistory(current, key, Date.now());
        if (next === current) return;
        this.write(next);
    }

    clear(): void {
        const current = this.read();
        if (current.entries.length === 0 && Object.keys(current.removed).length === 0) return;
        this.write(clearHistory(current, Date.now()));
    }

    applyRemote(state: HistoryState): void {
        this.write(state);
    }

    subscribe(listener: () => void): () => void {
        this.listeners.add(listener);
        return () => {
            this.listeners.delete(listener);
        };
    }

    private read(): HistoryState {
        if (this.state == null) this.state = parseHistoryState(this.store.getString(KEY));
        return this.state;
    }

    private write(next: HistoryState): void {
        this.state = next;
        this.snapshot = liveHistory(next);
        this.store.set(KEY, encodeHistoryState(next));
        this.listeners.forEach((listener) => listener());
    }
}
