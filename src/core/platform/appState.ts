import type {AppStateStatus, NativeEventSubscription} from 'react-native';
import {AppState} from 'react-native';

export type ForegroundListener = (active: boolean) => void;

const listeners = new Set<ForegroundListener>();
let subscription: NativeEventSubscription | null = null;
let active: boolean | null = null;

function currentlyActive(): boolean {
  return AppState.currentState === 'active';
}

function onChange(state: AppStateStatus): void {
  const next = state === 'active';
  if (next === active) return;
  active = next;
  for (const listener of [...listeners]) listener(next);
}

export function isForeground(): boolean {
  return active ?? currentlyActive();
}

export function subscribeForeground(listener: ForegroundListener): () => void {
  listeners.add(listener);
  if (subscription === null) {
    active = currentlyActive();
    subscription = AppState.addEventListener('change', onChange);
  }
  return () => {
    listeners.delete(listener);
    if (listeners.size > 0 || subscription === null) return;
    subscription.remove();
    subscription = null;
    active = null;
  };
}
