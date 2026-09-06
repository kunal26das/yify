import * as Network from 'expo-network';
import type {NetworkMonitor} from '@/domain';

export class ExpoNetworkMonitor implements NetworkMonitor {
    private online = true;
    private readonly listeners = new Set<() => void>();

    constructor() {
        void Network.getNetworkStateAsync()
            .then((state) => this.apply(state))
            .catch(() => {
            });
        try {
            Network.addNetworkStateListener((state) => this.apply(state));
        } catch {
        }
    }

    isOnline(): boolean {
        return this.online;
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
