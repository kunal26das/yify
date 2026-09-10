import {AppState} from 'react-native';
import * as Updates from 'expo-updates';

import {IDLE_UPDATE_STATUS, type AppUpdates, type Diagnostics, type UpdateStatus} from '@/domain';
import {NOOP_DIAGNOSTICS} from './NoopDiagnostics';

const ERROR_VISIBLE_MS = 6000;

export class ExpoAppUpdates implements AppUpdates {
    constructor(private readonly diagnostics: Diagnostics = NOOP_DIAGNOSTICS) {}
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
        this.diagnostics.event('updates.reload', {provider: 'expo', outcome: 'pending'});
        void Updates.reloadAsync().catch(error => {
            this.diagnostics.capture(error, 'updates.reload', {provider: 'expo'});
        });
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
            const download = this.diagnostics.start('updates.download', {provider: 'expo'});
            try {
                const fetched = await Updates.fetchUpdateAsync();
                download.finish(fetched.isNew ? 'ok' : 'empty');
                this.downloadFailed = false;
                this.publish(fetched.isNew ? {state: 'ready', progress: 1} : IDLE_UPDATE_STATUS);
            } catch (error) {
                download.fail(error);
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
        const span = this.diagnostics.start('updates.check', {provider: 'expo'});
        try {
            const result = await Updates.checkForUpdateAsync();
            span.finish(result.isAvailable ? 'ok' : 'empty');
            return result;
        } catch (error) {
            span.fail(error);
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
