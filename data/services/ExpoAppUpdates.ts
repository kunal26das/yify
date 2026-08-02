import {AppState} from 'react-native';
import * as Updates from 'expo-updates';

import {IDLE_UPDATE_STATUS, type AppUpdates, type UpdateStatus} from '@/domain';

export class ExpoAppUpdates implements AppUpdates {
    private status: UpdateStatus = IDLE_UPDATE_STATUS;
    private readonly listeners = new Set<() => void>();
    private syncing = false;
    private started = false;

    getStatus(): UpdateStatus {
        return this.status;
    }

    subscribe(listener: () => void): () => void {
        this.listeners.add(listener);
        return () => {
            this.listeners.delete(listener);
        };
    }

    start(): void {
        if (this.started) return;
        this.started = true;
        void this.sync();
        AppState.addEventListener('change', (next) => {
            if (next === 'active') void this.sync();
        });
    }

    dismiss(): void {
        this.publish(IDLE_UPDATE_STATUS);
    }

    restart(): void {
        void Updates.reloadAsync().catch(() => undefined);
    }

    async sync(): Promise<void> {
        if (this.syncing || !Updates.isEnabled) return;
        this.syncing = true;
        try {
            this.publish({state: 'checking', progress: 0});
            const check = await Updates.checkForUpdateAsync();
            if (!check.isAvailable) {
                this.publish(IDLE_UPDATE_STATUS);
                return;
            }
            this.publish({state: 'downloading', progress: 0});
            const fetched = await Updates.fetchUpdateAsync();
            this.publish(fetched.isNew ? {state: 'ready', progress: 1} : IDLE_UPDATE_STATUS);
        } catch {
            this.publish({state: 'error', progress: 0});
        } finally {
            this.syncing = false;
        }
    }

    private publish(next: UpdateStatus): void {
        this.status = next;
        this.listeners.forEach((listener) => listener());
    }
}
