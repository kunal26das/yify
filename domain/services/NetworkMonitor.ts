export interface NetworkMonitor {
    isOnline(): boolean;

    /** Refresh the platform snapshot after suspended or delayed network callbacks. */
    refresh?(): Promise<boolean>;

    subscribe(listener: () => void): () => void;
}
