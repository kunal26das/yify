/**
 * Over-the-air update progress, published as a tiny observable store.
 *
 * The CodePush higher-order component syncs on its own but gives the app no way to observe what it
 * is doing, so the sync is driven from here instead — `sync()` hands back both a status callback and
 * a byte-progress callback, which is everything the snackbar needs.
 *
 * The module is only ever reached on native: Metro serves ota-update.web.ts on web, so
 * `@revopush/react-native-code-push` is never pulled into the web bundle (a static import of it
 * breaks `expo export --platform web`). Even here the require stays inside the functions.
 */

export type OtaState = 'idle' | 'checking' | 'downloading' | 'installing' | 'ready' | 'error';

export interface OtaStatus {
    state: OtaState;
    /** 0–1 while downloading; 1 once installed. */
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

/** Clears the snackbar without touching the pending update, which still applies on next resume. */
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
                    // UP_TO_DATE and UPDATE_IGNORED are the normal quiet outcomes: say nothing.
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
        // Nothing to restart into — leave the app as it is.
    }
}
