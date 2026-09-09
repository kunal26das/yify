import type {SyncStatus} from '../entities/SyncStatus';

export interface AccountSync {
    start(): void;

    setAccount(uid: string | null): void;

    syncNow(): void;

    // Pause new work and wait for any in-flight sync request before deleting data.
    pause(): Promise<void>;

    resume(): void;

    deleteRemote(): Promise<boolean>;

    getStatus(): SyncStatus;

    subscribe(listener: () => void): () => void;
}
