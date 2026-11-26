import type {UpdateInfo, UpdateStartEvent} from 'expo-in-app-updates';
import {addUpdateListener, checkForUpdate, startUpdate} from 'expo-in-app-updates';
import {APP_NAME} from '@/core/config/app';
import {isForeground, subscribeForeground} from '@/core/platform/appState';
import {track} from '@/core/platform/telemetry/events';
import {reportOperation} from '@/core/platform/telemetry/operations';
import {kv} from '@/core/storage/kv';
import {KEYS} from '@/core/storage/keys';
import {showSnackbar} from '@/core/ui/components/SnackbarHost';
import {isPlayerOpen, subscribePlayerOpen} from '@/core/ui/overlays';

export type StoreUpdateType = 'flexible' | 'immediate';
export type StoreUpdateResult = 'started' | 'declined' | 'installed' | 'failed';
export type StoreUpdateInfo = UpdateInfo & {installStatus?: number};

export const STORE_UPDATE_DELAY_MS = 10_000;
export const STORE_UPDATE_THROTTLE_MS = 72 * 60 * 60 * 1000;
export const IMMEDIATE_UPDATE_PRIORITY = 4;
export const INSTALL_STATUS_DOWNLOADED = 11;
export const STORE_UPDATE_SNACKBAR_KEY = 'store-update';
export const DOWNLOADING_MESSAGE = `Downloading an update to ${APP_NAME}…`;
export const READY_MESSAGE = `Update ready. Restart ${APP_NAME} to finish.`;
export const RESTART_LABEL = 'Restart';

const OPERATION = 'updates.store';

let started = false;
let due = false;
let checked = false;
let waiting = false;
let flowType: StoreUpdateType = 'flexible';
let flowVersion: string | null = null;

function fail(stage: string, error: unknown): void {
  reportOperation(OPERATION, 'store', {error, attributes: {stage}});
}

function record(result: StoreUpdateResult): void {
  track({name: 'store_update', params: {type: flowType, result}});
}

function promptedWithinThrottle(version: string, now: number): boolean {
  const at = Number(kv.getString(KEYS.updatesPrompted(version)));
  if (!Number.isFinite(at) || at <= 0) return false;
  const age = now - at;
  return age >= 0 && age < STORE_UPDATE_THROTTLE_MS;
}

function downloadedBefore(version: string | null): boolean {
  return version !== null && kv.getString(KEYS.updatesDownloaded(version)) !== undefined;
}

function finishUpdate(stage: 'restart' | 'background'): void {
  startUpdate(false).catch((error: unknown) => fail(stage, error));
}

function restart(): void {
  finishUpdate('restart');
}

function awaitRestart(version: string | null): void {
  if (version !== null && !downloadedBefore(version)) kv.setString(KEYS.updatesDownloaded(version), String(Date.now()));
  if (waiting) return;
  waiting = true;
  showSnackbar({message: READY_MESSAGE, action: {label: RESTART_LABEL, onPress: restart}, duration: 'indefinite', key: STORE_UPDATE_SNACKBAR_KEY});
}

function begin(type: StoreUpdateType, version: string | null, start: () => Promise<boolean>): void {
  flowType = type;
  flowVersion = version;
  start().catch((error: unknown) => {
    record('failed');
    fail('start', error);
  });
}

export async function maybePromptStoreUpdate(): Promise<void> {
  let info: StoreUpdateInfo;
  try {
    info = await checkForUpdate();
  } catch (error) {
    fail('check', error);
    return;
  }
  if (!info.updateAvailable) return;
  const version = info.storeVersion ?? null;
  const priority = info.serverPriority ?? 0;
  if (info.updateInProgress) {
    if (info.installStatus === INSTALL_STATUS_DOWNLOADED || downloadedBefore(version)) {
      flowVersion = version;
      awaitRestart(version);
      return;
    }
    if (priority >= IMMEDIATE_UPDATE_PRIORITY) begin('immediate', version, () => startUpdate());
    return;
  }
  if (version === null) return;
  const now = Date.now();
  if (promptedWithinThrottle(version, now)) return;
  kv.setString(KEYS.updatesPrompted(version), String(now));
  if (priority >= IMMEDIATE_UPDATE_PRIORITY && info.immediateAllowed) {
    begin('immediate', version, () => startUpdate(true));
  } else if (info.flexibleAllowed) {
    begin('flexible', version, () => startUpdate(false));
  }
}

function checkWhenReady(): void {
  if (!due || checked || !isForeground() || isPlayerOpen()) return;
  checked = true;
  void maybePromptStoreUpdate();
}

function onForegroundChange(active: boolean): void {
  if (active) {
    checkWhenReady();
    return;
  }
  if (waiting) finishUpdate('background');
}

function onUpdateStart(event: UpdateStartEvent): void {
  flowType = event.updateType === 'IMMEDIATE' ? 'immediate' : 'flexible';
  record('started');
  if (event.updateType === 'FLEXIBLE') {
    showSnackbar({message: DOWNLOADING_MESSAGE, duration: 'short', key: STORE_UPDATE_SNACKBAR_KEY});
  }
}

function onUpdateDownloaded(): void {
  awaitRestart(flowVersion);
}

function onUpdateCancelled(): void {
  record('declined');
}

function onUpdateCompleted(): void {
  waiting = false;
  record('installed');
}

export function startStoreUpdates(): void {
  if (started) return;
  started = true;
  addUpdateListener('updateStart', onUpdateStart);
  addUpdateListener('updateDownloaded', onUpdateDownloaded);
  addUpdateListener('updateCancelled', onUpdateCancelled);
  addUpdateListener('updateCompleted', onUpdateCompleted);
  subscribeForeground(onForegroundChange);
  subscribePlayerOpen(checkWhenReady);
  setTimeout(() => {
    due = true;
    checkWhenReady();
  }, STORE_UPDATE_DELAY_MS);
}
