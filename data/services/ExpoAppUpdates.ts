import {AppState} from 'react-native';
import * as Updates from 'expo-updates';

import {IDLE_UPDATE_STATUS, type AppUpdates, type Diagnostics, type NetworkMonitor, type UpdateStatus} from '@/domain';
import {NOOP_DIAGNOSTICS} from './NoopDiagnostics';

const ERROR_VISIBLE_MS = 6000;
const UPDATE_ERROR_CODES = new Set([
    'ERR_NOT_AVAILABLE_IN_DEV_CLIENT', 'ERR_UPDATES_CHECK', 'ERR_UPDATES_CONFIG_OVERRIDE',
    'ERR_UPDATES_DISABLED', 'ERR_UPDATES_FETCH', 'ERR_UPDATES_READ_LOGS',
    'ERR_UPDATES_RELOAD', 'ERR_UPDATES_RUNTIME_OVERRIDE', 'ERR_UPDATES_UNSUPPORTED_DIRECTIVE',
]);

function updateErrorCode(error: unknown): string {
    try {
        const code = error != null && typeof error === 'object'
            ? (error as {code?: unknown}).code : undefined;
        return typeof code === 'string' && UPDATE_ERROR_CODES.has(code) ? code : 'unknown';
    } catch {
        return 'unknown';
    }
}

export class ExpoAppUpdates implements AppUpdates {
    constructor(
        private readonly diagnostics: Diagnostics = NOOP_DIAGNOSTICS,
        private readonly network?: NetworkMonitor,
    ) {}
    private status: UpdateStatus = IDLE_UPDATE_STATUS;
    private readonly listeners = new Set<() => void>();
    private syncing = false;
    private started = false;
    private reloading = false;
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
            void this.sync();
        });
        this.network?.subscribe(() => {
            if (this.network?.isOnline()) void this.sync();
        });
    }

    dismiss(): void {
        this.publish(IDLE_UPDATE_STATUS);
    }

    restart(): void {
        if (this.reloading || this.status.state !== 'ready') return;
        this.reloading = true;
        this.publish({state: 'installing', progress: 1});
        this.diagnostics.event('updates.reload', {provider: 'expo', outcome: 'pending'});
        void Updates.reloadAsync().catch(error => {
            this.reloading = false;
            this.publish({state: 'ready', progress: 1});
            this.diagnostics.capture(error, 'updates.reload', {provider: 'expo', error_code: updateErrorCode(error)});
        });
    }

    async sync(): Promise<void> {
        if (this.syncing || this.reloading || this.status.state === 'ready' || !Updates.isEnabled || !Updates.channel) return;
        if (AppState.currentState !== 'active') return;
        if (this.network?.isOnline() === false) {
            this.diagnostics.event('updates.check', {provider: 'expo', outcome: 'unavailable', reason: 'offline'});
            return;
        }
        this.syncing = true;
        try {
            this.publish({state: 'checking', progress: 0});

            const check = await this.check();
            if (!check?.isAvailable) {
                this.publish(IDLE_UPDATE_STATUS);
                return;
            }
            if (AppState.currentState !== 'active' || this.network?.isOnline() === false) {
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
                this.finishFailure(download, error);
                if (AppState.currentState !== 'active' || this.network?.isOnline() === false) {
                    this.publish(IDLE_UPDATE_STATUS);
                    return;
                }
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
            this.finishFailure(span, error);
            return null;
        }
    }

    private finishFailure(span: ReturnType<Diagnostics['start']>, error: unknown): void {
        const code = updateErrorCode(error);
        const interrupted = code === 'ERR_UPDATES_CHECK' || code === 'ERR_UPDATES_FETCH';
        const reason = this.network?.isOnline() === false ? 'offline' :
            AppState.currentState !== 'active' ? 'background' : undefined;
        if (interrupted && reason === 'offline') span.finish('unavailable', {error_code: code, reason});
        else span.fail(error, {error_code: code, ...(reason ? {reason} : {})});
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
