import type {ApiErrorCode} from '@/core/domain/api';
import {apiUrl, CLIENT_HEADER} from './baseUrl';
import {ApiDecodeError, ApiError, isAbortError, isTransportFailure, NetworkError, TimeoutError} from './errors';
import {apiHealth, healthOutcome} from './health';

export interface RequestOptions {
  signal?: AbortSignal;
  timeoutMs?: number;
}

export type ApiObservationStatus = number | 'network' | 'timeout' | 'decode';

export interface ApiObservation {
  route: string;
  status: ApiObservationStatus;
  ms: number;
}

export type ApiObserver = (result: ApiObservation) => void;

export type ApiQuery = Record<string, string | number | undefined>;

export const GET_TIMEOUT_MS = 15_000;
export const POST_TIMEOUT_MS = 25_000;
export const MAX_RETRY_AFTER_MS = 60_000;

const ERROR_CODES: Readonly<Record<ApiErrorCode, true>> = {
  invalid_request: true,
  not_found: true,
  method_not_allowed: true,
  payload_too_large: true,
  rate_limited: true,
  upstream_rate_limited: true,
  upstream_unavailable: true,
  upstream_timeout: true,
  internal: true,
};

let observer: ApiObserver | null = null;

export function setApiObserver(next: ApiObserver | null): void {
  observer = next;
}

function observe(result: ApiObservation): void {
  try {
    observer?.(result);
  } catch {
    return;
  }
}

export function apiRoute(path: string): string {
  const segments = path.split(/[?#]/, 1)[0].split('/').filter(Boolean);
  if (segments[0] === 'title' && segments[3] === 'season') return 'season';
  if (segments[0] === 'legacy') return 'legacy-movie';
  return segments[0] ?? 'unknown';
}

export function apiQueryString(query: ApiQuery): string {
  return Object.keys(query)
    .filter((key) => query[key] !== undefined && query[key] !== '')
    .sort()
    .map((key) => `${encodeURIComponent(key)}=${encodeURIComponent(String(query[key])).replace(/%2C/gi, ',')}`)
    .join('&');
}

function sortKeys(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortKeys);
  if (typeof value !== 'object' || value === null) return value;
  const sorted: Record<string, unknown> = {};
  for (const key of Object.keys(value).sort()) sorted[key] = sortKeys(Reflect.get(value, key));
  return sorted;
}

export function stableJson(value: unknown): string {
  return JSON.stringify(sortKeys(value));
}

export function parseRetryAfter(header: string | null, bodySeconds: unknown, now: number = Date.now()): number | null {
  let milliseconds: number | null = null;
  const value = header?.trim() ?? '';
  if (/^\d+$/.test(value)) milliseconds = Number(value) * 1000;
  else if (value) {
    const date = Date.parse(value);
    if (Number.isFinite(date)) milliseconds = Math.max(0, date - now);
  }
  if (milliseconds === null && typeof bodySeconds === 'number' && Number.isFinite(bodySeconds) && bodySeconds >= 0) {
    milliseconds = bodySeconds * 1000;
  }
  return milliseconds === null ? null : Math.min(MAX_RETRY_AFTER_MS, Math.round(milliseconds));
}

function isErrorCode(value: unknown): value is ApiErrorCode {
  return typeof value === 'string' && Object.hasOwn(ERROR_CODES, value);
}

function envelope(text: string): {code: ApiErrorCode; retryAfterSeconds: unknown} {
  try {
    const body: unknown = JSON.parse(text);
    const error: unknown = typeof body === 'object' && body !== null ? Reflect.get(body, 'error') : undefined;
    const code: unknown = typeof error === 'object' && error !== null ? Reflect.get(error, 'code') : undefined;
    const retryAfterSeconds: unknown = typeof error === 'object' && error !== null ? Reflect.get(error, 'retryAfterSeconds') : undefined;
    return {code: isErrorCode(code) ? code : 'internal', retryAfterSeconds};
  } catch {
    return {code: 'internal', retryAfterSeconds: undefined};
  }
}

async function apiErrorFrom(response: Response): Promise<ApiError> {
  let text = '';
  try {
    text = await response.text();
  } catch {
    text = '';
  }
  const {code, retryAfterSeconds} = envelope(text);
  return new ApiError(response.status, code, parseRetryAfter(response.headers.get('Retry-After'), retryAfterSeconds));
}

interface Attempt {
  method: 'GET' | 'POST';
  path: string;
  body?: string;
  signal?: AbortSignal;
  timeoutMs: number;
}

function abortReason(signal: AbortSignal): unknown {
  if (signal.reason !== undefined) return signal.reason;
  const error = new Error('The operation was aborted.');
  error.name = 'AbortError';
  return error;
}

async function send<T>(attempt: Attempt, decode: (body: unknown) => T): Promise<T> {
  const {signal} = attempt;
  if (signal?.aborted) throw abortReason(signal);
  const route = apiRoute(attempt.path);
  const started = Date.now();
  const controller = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, attempt.timeoutMs);
  const relay = () => controller.abort();
  signal?.addEventListener('abort', relay);
  const elapsed = () => Date.now() - started;
  const fail = (error: unknown): unknown => {
    if (timedOut) {
      apiHealth.record('network-error');
      observe({route, status: 'timeout', ms: elapsed()});
      return new TimeoutError();
    }
    if (signal?.aborted) return isAbortError(error) ? error : abortReason(signal);
    if (isAbortError(error)) return error;
    if (isTransportFailure(error)) {
      apiHealth.record('network-error');
      observe({route, status: 'network', ms: elapsed()});
      return new NetworkError();
    }
    return error;
  };
  try {
    let response: Response;
    try {
      const headers: Record<string, string> = {'Accept': 'application/json', 'X-Yify-Client': CLIENT_HEADER};
      if (attempt.body !== undefined) headers['Content-Type'] = 'application/json';
      response = await fetch(apiUrl(attempt.path), {
        method: attempt.method,
        headers,
        body: attempt.body,
        credentials: 'omit',
        redirect: 'error',
        signal: controller.signal,
      });
    } catch (error) {
      throw fail(error);
    }
    apiHealth.record(healthOutcome(response.status));
    if (!response.ok) {
      const error = await apiErrorFrom(response);
      if (timedOut || signal?.aborted) throw fail(undefined);
      observe({route, status: response.status, ms: elapsed()});
      throw error;
    }
    let body: unknown;
    try {
      body = await response.json();
    } catch (error) {
      if (timedOut || signal?.aborted || isTransportFailure(error)) throw fail(error);
      observe({route, status: 'decode', ms: elapsed()});
      throw new ApiDecodeError(route);
    }
    let value: T;
    try {
      value = decode(body);
    } catch (error) {
      observe({route, status: 'decode', ms: elapsed()});
      throw error instanceof ApiDecodeError ? error : new ApiDecodeError(route);
    }
    observe({route, status: response.status, ms: elapsed()});
    return value;
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', relay);
  }
}

export function apiGet<T>(path: string, query: ApiQuery, decode: (body: unknown) => T, options?: RequestOptions): Promise<T> {
  const search = apiQueryString(query);
  return send({
    method: 'GET',
    path: search ? `${path}?${search}` : path,
    signal: options?.signal,
    timeoutMs: options?.timeoutMs ?? GET_TIMEOUT_MS,
  }, decode);
}

export function apiPost<T>(path: string, body: unknown, decode: (body: unknown) => T, options?: RequestOptions): Promise<T> {
  return send({
    method: 'POST',
    path,
    body: stableJson(body),
    signal: options?.signal,
    timeoutMs: options?.timeoutMs ?? POST_TIMEOUT_MS,
  }, decode);
}
