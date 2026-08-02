import type {UpdateStatus} from '../entities/UpdateStatus';

export interface AppUpdates {
    getStatus(): UpdateStatus;

    subscribe(listener: () => void): () => void;

    start(): void;

    sync(): Promise<void>;

    dismiss(): void;

    restart(): void;
}
