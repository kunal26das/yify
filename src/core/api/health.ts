export type ApiHealthOutcome = 'ok' | 'server-error' | 'network-error';

export interface ApiHealth {
  record(outcome: ApiHealthOutcome): void;
  degraded(): boolean;
  reset(): void;
}

export const BREAKER_WINDOW_MS = 60_000;
export const BREAKER_THRESHOLD = 3;

export function createApiHealth(now: () => number = Date.now): ApiHealth {
  let errors: number[] = [];
  let degradedUntil = 0;
  return {
    record(outcome) {
      if (outcome === 'network-error') return;
      if (outcome === 'ok') {
        errors = [];
        degradedUntil = 0;
        return;
      }
      const at = now();
      errors = [...errors.filter((time) => at - time < BREAKER_WINDOW_MS && at >= time), at];
      if (at < degradedUntil || errors.length >= BREAKER_THRESHOLD) degradedUntil = at + BREAKER_WINDOW_MS;
    },
    degraded() {
      return now() < degradedUntil;
    },
    reset() {
      errors = [];
      degradedUntil = 0;
    },
  };
}

export const apiHealth: ApiHealth = createApiHealth();

export function healthOutcome(status: number): ApiHealthOutcome {
  return status >= 500 && status <= 504 ? 'server-error' : 'ok';
}
