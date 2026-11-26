import type {SyncStatus} from '@/core/domain/sync/types';

const SIGNED_OUT: SyncStatus = {state: 'signed-out'};
const V1_IMPORT_IDLE = {lastImportedAt: null, running: false};

export function useSyncStatus(): SyncStatus {
  return SIGNED_OUT;
}

export function syncNow(): void {
  return;
}

export function startSync(): void {
  return;
}

export async function prepareSignOut(uid: string): Promise<void> {
  return;
}

export async function pauseSync(): Promise<void> {
  return;
}

export function resumeSync(): void {
  return;
}

export async function deleteRemoteAccountData(uid: string): Promise<'ok' | 'failed'> {
  return 'ok';
}

export function clearLocalAccountData(uid: string): void {
  return;
}

export function useV1ImportStatus(): {lastImportedAt: number | null; running: boolean} {
  return V1_IMPORT_IDLE;
}

export async function importV1Again(): Promise<'ok' | 'failed'> {
  return 'ok';
}
