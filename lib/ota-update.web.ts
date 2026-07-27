/**
 * Web stand-in for the native OTA store.
 *
 * The web build is deployed as static files, so there is no CodePush bundle to sync — the status
 * stays idle and the snackbar never renders. Keeping this file is also what stops
 * `@revopush/react-native-code-push` from reaching the web bundle at all.
 */

export type OtaState = 'idle' | 'checking' | 'downloading' | 'installing' | 'ready' | 'error';

export interface OtaStatus {
    state: OtaState;
    progress: number;
}

const IDLE: OtaStatus = {state: 'idle', progress: 0};

export function getOtaStatus(): OtaStatus {
    return IDLE;
}

export function subscribeOta(): () => void {
    return () => {};
}

export function dismissOta(): void {}

export async function syncOta(): Promise<void> {}

export function restartApp(): void {}
