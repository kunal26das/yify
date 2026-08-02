import {AppState} from 'react-native';

import {IDLE_UPDATE_STATUS, type AppUpdates, type UpdateStatus} from '@/domain';

export class CodePushAppUpdates implements AppUpdates {
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
        try {
            const codePush = require('@revopush/react-native-code-push');
            codePush.restartApp();
        } catch {
        }
    }

    async sync(): Promise<void> {
        if (this.syncing) return;
        this.syncing = true;
        try {
            const codePush = require('@revopush/react-native-code-push');
            const Status = codePush.SyncStatus;
            await codePush.sync(
                {installMode: codePush.InstallMode.ON_NEXT_RESUME},
                (s: number) => {
                    switch (s) {
                        case Status.CHECKING_FOR_UPDATE:
                            this.publish({state: 'checking', progress: 0});
                            break;
                        case Status.DOWNLOADING_PACKAGE:
                            this.publish({state: 'downloading', progress: 0});
                            break;
                        case Status.INSTALLING_UPDATE:
                            this.publish({state: 'installing', progress: 1});
                            break;
                        case Status.UPDATE_INSTALLED:
                            this.publish({state: 'ready', progress: 1});
                            break;
                        case Status.UNKNOWN_ERROR:
                            this.publish({state: 'error', progress: 0});
                            break;
                        default:
                            this.publish(IDLE_UPDATE_STATUS);
                    }
                },
                ({receivedBytes, totalBytes}: {receivedBytes: number; totalBytes: number}) => {
                    this.publish({
                        state: 'downloading',
                        progress: totalBytes > 0 ? Math.min(1, receivedBytes / totalBytes) : 0,
                    });
                }
            );
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
