export interface NetworkMonitor {
    isOnline(): boolean;

    subscribe(listener: () => void): () => void;
}
