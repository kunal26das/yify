import type {ForegroundListener} from './appState';

export type {ForegroundListener};

const listeners = new Set<ForegroundListener>();
let attached = false;
let active: boolean | null = null;

function visible(): boolean {
  return typeof document !== 'undefined' && document.visibilityState === 'visible';
}

function onChange(): void {
  const next = visible();
  if (next === active) return;
  active = next;
  for (const listener of [...listeners]) listener(next);
}

export function isForeground(): boolean {
  return active ?? visible();
}

export function subscribeForeground(listener: ForegroundListener): () => void {
  listeners.add(listener);
  if (!attached && typeof document !== 'undefined') {
    active = visible();
    document.addEventListener('visibilitychange', onChange);
    attached = true;
  }
  return () => {
    listeners.delete(listener);
    if (listeners.size > 0 || !attached || typeof document === 'undefined') return;
    document.removeEventListener('visibilitychange', onChange);
    attached = false;
    active = null;
  };
}
