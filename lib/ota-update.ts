
export type OtaState = 'idle' | 'checking' | 'downloading' | 'installing' | 'ready' | 'error';

export interface OtaStatus {
    state: OtaState;
    progress: number;
}

const IDLE: OtaStatus = {state: 'idle', progress: 0};

let status: OtaStatus = IDLE;
const listeners = new Set<() => void>();

function publish(next: OtaStatus): void {
    status = next;
    listeners.forEach((listener) => listener());
}

export function getOtaStatus(): OtaStatus {
    return status;
}

export function subscribeOta(listener: () => void): () => void {
    listeners.add(listener);
    return () => {
        listeners.delete(listener);
    };
}

export function dismissOta(): void {
    publish(IDLE);
}

let syncing = false;

export async function syncOta(): Promise<void> {
    if (syncing) return;
    syncing = true;
    try {
        const codePush = require('@revopush/react-native-code-push');
        const Status = codePush.SyncStatus;
        await codePush.sync(
            {installMode: codePush.InstallMode.ON_NEXT_RESUME},
            (s: number) => {
                switch (s) {
                    case Status.CHECKING_FOR_UPDATE:
                        publish({state: 'checking', progress: 0});
                        break;
                    case Status.DOWNLOADING_PACKAGE:
                        publish({state: 'downloading', progress: 0});
                        break;
                    case Status.INSTALLING_UPDATE:
                        publish({state: 'installing', progress: 1});
                        break;
                    case Status.UPDATE_INSTALLED:
                        publish({state: 'ready', progress: 1});
                        break;
                    case Status.UNKNOWN_ERROR:
                        publish({state: 'error', progress: 0});
                        break;
                    default:
                        publish(IDLE);
                }
            },
            ({receivedBytes, totalBytes}: {receivedBytes: number; totalBytes: number}) => {
                publish({
                    state: 'downloading',
                    progress: totalBytes > 0 ? Math.min(1, receivedBytes / totalBytes) : 0,
                });
            }
        );
    } catch {
        publish({state: 'error', progress: 0});
    } finally {
        syncing = false;
    }
}

export function restartApp(): void {
    try {
        const codePush = require('@revopush/react-native-code-push');
        codePush.restartApp();
    } catch {
    }
}
