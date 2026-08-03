export type SyncState = 'idle' | 'syncing' | 'synced' | 'error';

export type SyncFailure = 'denied' | 'network' | 'server' | 'oversized';

export interface SyncStatus {
    state: SyncState;
    failure: SyncFailure | null;
    detail: string | null;
    lastSyncedAt: number | null;
    pendingChanges: boolean;
}

export const IDLE_SYNC_STATUS: SyncStatus = {
    state: 'idle',
    failure: null,
    detail: null,
    lastSyncedAt: null,
    pendingChanges: false,
};
