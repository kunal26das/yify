import {OPERATION_METRIC} from './names';
import {sentryBreadcrumb, sentryCapture, sentryCount, TELEMETRY_PLATFORM} from './sentry';

export type OperationOutcome =
  | 'ok' | 'cancelled' | 'offline' | 'network' | 'timeout' | 'http_404' | 'http_429' | 'http_5xx'
  | 'no_fill' | 'store' | 'billing_unavailable' | 'configuration' | 'blocked'
  | 'invalid_response' | 'http_4xx' | 'unknown';

export const EXPECTED_OUTCOMES: ReadonlySet<OperationOutcome> = new Set<OperationOutcome>([
  'ok', 'cancelled', 'offline', 'network', 'timeout', 'http_404', 'http_429', 'http_5xx',
  'no_fill', 'store', 'billing_unavailable', 'configuration', 'blocked',
]);

export interface OperationDetail {
  error?: unknown;
  attributes?: Record<string, string | number | boolean>;
}

const OPERATION = /^[a-z][a-z0-9_]*(?:\.[a-z][a-z0-9_]*)+$/;
const captured = new Set<string>();

export class OperationError extends Error {
  readonly operation: string;
  readonly outcome: OperationOutcome;

  constructor(operation: string, outcome: OperationOutcome) {
    super(`${operation} ${outcome}`);
    this.name = 'OperationError';
    this.operation = operation;
    this.outcome = outcome;
  }
}

export function reportOperation(operation: string, outcome: OperationOutcome, detail?: OperationDetail): void {
  if (!OPERATION.test(operation) || operation.length > 80) return;
  sentryCount(OPERATION_METRIC, {...detail?.attributes, operation, outcome, platform: TELEMETRY_PLATFORM});
  sentryBreadcrumb('operation', `${operation} ${outcome}`);
  if (EXPECTED_OUTCOMES.has(outcome)) return;
  const key = `${operation}:${outcome}`;
  if (captured.has(key)) return;
  captured.add(key);
  sentryCapture(detail?.error ?? new OperationError(operation, outcome), {operation, outcome});
}

export function resetReportedOperations(): void {
  captured.clear();
}
