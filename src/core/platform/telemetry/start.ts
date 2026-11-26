import type {ApiObservation} from '@/core/api/client';
import {setApiObserver} from '@/core/api/client';
import {isOnline} from '@/core/platform/network';
import {applyAnalyticsConsent} from './analytics';
import {analyticsConsented, subscribeTelemetryConsent} from './consent';
import type {OperationOutcome} from './operations';
import {reportOperation} from './operations';

let started = false;

export function apiOperation(route: string): string {
  return `api.${route.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '') || 'unknown'}`;
}

export function apiOutcome(result: ApiObservation, online: boolean): OperationOutcome {
  const {status} = result;
  if (status === 'network') return online ? 'network' : 'offline';
  if (status === 'timeout') return 'timeout';
  if (status === 'decode') return 'invalid_response';
  if (status >= 200 && status < 400) return 'ok';
  if (status === 404) return 'http_404';
  if (status === 429) return 'http_429';
  if (status >= 500) return 'http_5xx';
  return 'http_4xx';
}

export function observeApi(result: ApiObservation): void {
  reportOperation(apiOperation(result.route), apiOutcome(result, isOnline()), {attributes: {ms: Math.max(0, Math.round(result.ms))}});
}

export function startTelemetry(): void {
  if (started) return;
  started = true;
  setApiObserver(observeApi);
  subscribeTelemetryConsent((analytics) => applyAnalyticsConsent(analytics));
  applyAnalyticsConsent(analyticsConsented());
}
