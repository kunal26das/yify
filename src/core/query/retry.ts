import {ApiError, NetworkError, TimeoutError} from '@/core/api/errors';
import {apiHealth} from '@/core/api/health';

export function shouldRetry(failureCount: number, error: unknown): boolean {
  if (error instanceof ApiError) {
    if (error.status === 429 || error.status === 503) return failureCount < 1 && (error.retryAfterMs ?? 0) <= 60_000;
    if (error.status >= 500) return failureCount < 1 && !apiHealth.degraded();
    return false;
  }
  if (error instanceof NetworkError || error instanceof TimeoutError) return failureCount < 2;
  return false;
}

export function retryDelay(failureCount: number, error: unknown): number {
  if (error instanceof ApiError && error.retryAfterMs != null) return error.retryAfterMs;
  const base = Math.min(30_000, 2_000 * 2 ** failureCount);
  return Math.round(base * (0.5 + Math.random()));
}
