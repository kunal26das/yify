type ConsentListener = (analytics: boolean) => void;

const listeners = new Set<ConsentListener>();
let analyticsAllowed = false;
let revision = 0;

export function applyTelemetryConsent(analytics: boolean): void {
  if (analytics === analyticsAllowed) return;
  analyticsAllowed = analytics;
  revision += 1;
  for (const listener of [...listeners]) {
    try {
      listener(analytics);
    } catch {
      continue;
    }
  }
}

export function analyticsConsented(): boolean {
  return analyticsAllowed;
}

export function consentToken(): number | undefined {
  return analyticsAllowed ? revision : undefined;
}

export function consentPermits(token: unknown): boolean {
  return analyticsAllowed && token === revision;
}

export function subscribeTelemetryConsent(listener: ConsentListener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
