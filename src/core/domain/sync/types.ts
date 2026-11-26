export type SectionName = 'watchlist' | 'diary' | 'lists' | 'recent' | 'preferences';

export type SyncFailure = 'offline' | 'denied' | 'server' | 'oversized' | 'newer-schema';

export type SyncStatus =
  | {state: 'signed-out'}
  | {state: 'idle' | 'syncing'; lastSyncedAt: number | null; pending: boolean}
  | {state: 'error'; failure: SyncFailure; sections: SectionName[]; lastSyncedAt: number | null; pending: boolean}
  | {state: 'deleted'};

export interface SyncedStoreAccess<S> {
  read(): {rev: number; state: S};
  apply(state: S, options: {dirty: boolean}): void;
  subscribe(listener: () => void): () => void;
  reset(): void;
}
