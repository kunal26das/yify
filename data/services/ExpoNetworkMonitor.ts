import * as Network from 'expo-network';
import type {NetworkMonitor} from '@/domain';
import {watchForeground} from '../datasources/platform/ForegroundWatcher';

const SNAPSHOT_TIMEOUT_MS = 3000;

export class ExpoNetworkMonitor implements NetworkMonitor {
    private online = true;
    private readonly listeners = new Set<() => void>();
    private revision = 0;
    private refreshPromise: Promise<boolean> | null = null;

    constructor() {
        try {
            Network.addNetworkStateListener((state) => {
                this.revision += 1;
                this.apply(state);
            });
        } catch {
        }
        watchForeground(() => { void this.refresh(); });
        void this.refresh();
    }

    isOnline(): boolean {
        return this.online;
    }

    refresh(): Promise<boolean> {
        if (this.refreshPromise) return this.refreshPromise;
        let revision = this.revision;
        let expired = false;
        let timer: ReturnType<typeof setTimeout>;
        const timeout = new Promise<boolean>(resolve => {
            timer = setTimeout(() => {
                expired = true;
                resolve(this.online);
            }, SNAPSHOT_TIMEOUT_MS);
        });
        const snapshot = Promise.resolve()
            .then(() => Network.getNetworkStateAsync())
            .then(async state => {
                // Android can deliver deferred callbacks out of order after resuming. If one
                // raced this read, query once more instead of trusting either stale snapshot.
                if (!expired && revision !== this.revision) {
                    revision = this.revision;
                    state = await Network.getNetworkStateAsync();
                }
                if (!expired && revision === this.revision) this.apply(state);
                return this.online;
            })
            .catch(() => this.online);
        this.refreshPromise = Promise.race([snapshot, timeout])
            .finally(() => {
                clearTimeout(timer);
                this.refreshPromise = null;
            });
        return this.refreshPromise;
    }

    subscribe(listener: () => void): () => void {
        this.listeners.add(listener);
        return () => {
            this.listeners.delete(listener);
        };
    }

    private apply(state: Network.NetworkState): void {
        const next = state.isConnected !== false && state.isInternetReachable !== false;
        if (next === this.online) return;
        this.online = next;
        this.listeners.forEach((listener) => listener());
    }
}
