import type {OnlineListener} from './network';

export type {OnlineListener};

const listeners = new Set<OnlineListener>();
let attached = false;
let online: boolean | null = null;

function current(): boolean {
  return typeof navigator === 'undefined' || navigator.onLine !== false;
}

function onChange(): void {
  const next = current();
  if (next === online) return;
  online = next;
  for (const listener of [...listeners]) listener(next);
}

export function isOnline(): boolean {
  return online ?? current();
}

export function refreshNetwork(): Promise<boolean> {
  onChange();
  return Promise.resolve(isOnline());
}

export function subscribeOnline(listener: OnlineListener): () => void {
  listeners.add(listener);
  if (!attached && typeof window !== 'undefined') {
    online = current();
    window.addEventListener('online', onChange);
    window.addEventListener('offline', onChange);
    attached = true;
  }
  return () => {
    listeners.delete(listener);
    if (listeners.size > 0 || !attached || typeof window === 'undefined') return;
    window.removeEventListener('online', onChange);
    window.removeEventListener('offline', onChange);
    attached = false;
    online = null;
  };
}
