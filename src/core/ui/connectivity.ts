import {useSyncExternalStore} from 'react';

export const OFFLINE_BANNER_DELAY_MS = 2000;
export const BACK_ONLINE_MESSAGE = 'Back online';

interface ConnectivityState {
  online: boolean;
  bannerVisible: boolean;
}

let state: ConnectivityState = {online: true, bannerVisible: false};
let bannerTimer: ReturnType<typeof setTimeout> | null = null;
const listeners = new Set<() => void>();
const backOnlineListeners = new Set<() => void>();

function publish(next: ConnectivityState): void {
  if (next.online === state.online && next.bannerVisible === state.bannerVisible) return;
  state = next;
  for (const listener of [...listeners]) listener();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function clearBannerTimer(): void {
  if (bannerTimer !== null) clearTimeout(bannerTimer);
  bannerTimer = null;
}

export function setConnectivity(online: boolean): void {
  if (online === state.online) return;
  clearBannerTimer();
  if (!online) {
    publish({online: false, bannerVisible: false});
    bannerTimer = setTimeout(() => {
      bannerTimer = null;
      if (!state.online) publish({online: false, bannerVisible: true});
    }, OFFLINE_BANNER_DELAY_MS);
    return;
  }
  const announce = state.bannerVisible;
  publish({online: true, bannerVisible: false});
  if (announce) for (const listener of [...backOnlineListeners]) listener();
}

export function subscribeBackOnline(listener: () => void): () => void {
  backOnlineListeners.add(listener);
  return () => {
    backOnlineListeners.delete(listener);
  };
}

export function isOnline(): boolean {
  return state.online;
}

function bannerSnapshot(): boolean {
  return state.bannerVisible;
}

function serverBanner(): boolean {
  return false;
}

export function useOfflineBannerVisible(): boolean {
  return useSyncExternalStore(subscribe, bannerSnapshot, serverBanner);
}
