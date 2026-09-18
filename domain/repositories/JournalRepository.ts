import type {JournalInput, JournalSnapshot} from '../entities/Journal';

export interface JournalRepository {
    start(): void;
    getSnapshot(): JournalSnapshot;
    subscribe(listener: () => void): () => void;
    save(input: JournalInput): string;
    remove(id: string): void;
    retrySync(): void;
    pause(): Promise<void>;
    resume(): void;
    deleteRemote(): Promise<boolean>;
}
