import type {NetworkState} from 'expo-network';
import {addNetworkStateListener, getNetworkStateAsync} from 'expo-network';
import {subscribeForeground} from './appState';

export type OnlineListener = (online: boolean) => void;

export const NETWORK_SNAPSHOT_TIMEOUT_MS = 3000;

const listeners = new Set<OnlineListener>();
let online = true;
let revision = 0;
let networkSubscription: ReturnType<typeof addNetworkStateListener> | null = null;
let stopForeground: (() => void) | null = null;
let refreshing: Promise<boolean> | null = null;

function apply(state: NetworkState): void {
  const next = state.isConnected !== false && state.isInternetReachable !== false;
  if (next === online) return;
  online = next;
  for (const listener of [...listeners]) listener(next);
}

export function isOnline(): boolean {
  return online;
}

export function refreshNetwork(): Promise<boolean> {
  if (refreshing) return refreshing;
  let seen = revision;
  let expired = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<boolean>((resolve) => {
    timer = setTimeout(() => {
      expired = true;
      resolve(online);
    }, NETWORK_SNAPSHOT_TIMEOUT_MS);
  });
  const snapshot = Promise.resolve()
    .then(() => getNetworkStateAsync())
    .then(async (first) => {
      let state = first;
      if (!expired && seen !== revision) {
        seen = revision;
        state = await getNetworkStateAsync();
      }
      if (!expired && seen === revision) apply(state);
      return online;
    })
    .catch(() => online);
  const pending = Promise.race([snapshot, timeout]).finally(() => {
    clearTimeout(timer);
    if (refreshing === pending) refreshing = null;
  });
  refreshing = pending;
  return pending;
}

function start(): void {
  if (networkSubscription !== null || stopForeground !== null) return;
  try {
    networkSubscription = addNetworkStateListener((state) => {
      revision += 1;
      apply(state);
    });
  } catch {
    networkSubscription = null;
  }
  stopForeground = subscribeForeground((active) => {
    if (active) void refreshNetwork();
  });
  void refreshNetwork();
}

function stop(): void {
  networkSubscription?.remove();
  networkSubscription = null;
  stopForeground?.();
  stopForeground = null;
}

export function subscribeOnline(listener: OnlineListener): () => void {
  listeners.add(listener);
  start();
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) stop();
  };
}
