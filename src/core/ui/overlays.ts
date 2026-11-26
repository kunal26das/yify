import {useSyncExternalStore} from 'react';

let playerOpen = false;
const listeners = new Set<() => void>();

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function snapshot(): boolean {
  return playerOpen;
}

function serverSnapshot(): boolean {
  return false;
}

export function setPlayerOpen(open: boolean): void {
  if (playerOpen === open) return;
  playerOpen = open;
  for (const listener of [...listeners]) listener();
}

export function isPlayerOpen(): boolean {
  return playerOpen;
}

export function subscribePlayerOpen(listener: () => void): () => void {
  return subscribe(listener);
}

export function usePlayerOpen(): boolean {
  return useSyncExternalStore(subscribe, snapshot, serverSnapshot);
}
