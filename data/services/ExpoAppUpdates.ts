import {AppState} from 'react-native';
import * as Updates from 'expo-updates';

import {IDLE_UPDATE_STATUS, type AppUpdates, type UpdateStatus} from '@/domain';

const ERROR_VISIBLE_MS = 6000;

export class ExpoAppUpdates implements AppUpdates {
    private status: UpdateStatus = IDLE_UPDATE_STATUS;
    private readonly listeners = new Set<() => void>();
    private syncing = false;
    private started = false;
    private downloadFailed = false;
    private errorTimer: ReturnType<typeof setTimeout> | null = null;

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
            if (next !== 'active') return;
            if (this.status.state === 'ready') {
                this.restart();
                return;
            }
            void this.sync();
        });
    }

    dismiss(): void {
        this.publish(IDLE_UPDATE_STATUS);
    }

    restart(): void {
        void Updates.reloadAsync().catch(() => undefined);
    }

    async sync(): Promise<void> {
        if (this.syncing || !Updates.isEnabled || !Updates.channel) return;
        this.syncing = true;
        try {
            this.publish({state: 'checking', progress: 0});

            const check = await this.check();
            if (!check?.isAvailable) {
                this.publish(IDLE_UPDATE_STATUS);
                return;
            }

            this.publish({state: 'downloading', progress: 0});
            try {
                const fetched = await Updates.fetchUpdateAsync();
                this.downloadFailed = false;
                this.publish(fetched.isNew ? {state: 'ready', progress: 1} : IDLE_UPDATE_STATUS);
            } catch {
                if (this.downloadFailed) {
                    this.publish(IDLE_UPDATE_STATUS);
                    return;
                }
                this.downloadFailed = true;
                this.publish({state: 'error', progress: 0});
                this.errorTimer = setTimeout(() => this.dismiss(), ERROR_VISIBLE_MS);
            }
        } finally {
            this.syncing = false;
        }
    }

    private async check(): Promise<Updates.UpdateCheckResult | null> {
        try {
            return await Updates.checkForUpdateAsync();
        } catch {
            return null;
        }
    }

    private publish(next: UpdateStatus): void {
        if (this.errorTimer) {
            clearTimeout(this.errorTimer);
            this.errorTimer = null;
        }
        this.status = next;
        this.listeners.forEach((listener) => listener());
    }
}
