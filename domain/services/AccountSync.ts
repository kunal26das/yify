import type {SyncStatus} from '../entities/SyncStatus';

export interface AccountSync {
    start(): void;

    setAccount(uid: string | null): void;

    syncNow(): void;

    getStatus(): SyncStatus;

    subscribe(listener: () => void): () => void;
}
