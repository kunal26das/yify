import type {HistoryEntry} from '../entities/HistoryEntry';
import type {HistoryState} from '../policies/historyMerge';

export interface WatchHistoryRepository {
    getAll(): HistoryEntry[];

    getState(): HistoryState;

    record(entry: HistoryEntry): void;

    remove(key: string): void;

    clear(): void;

    applyRemote(state: HistoryState): void;

    subscribe(listener: () => void): () => void;
}
