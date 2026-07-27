
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
