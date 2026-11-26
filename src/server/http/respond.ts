import {SITE_ORIGIN} from '@/core/config/app';
import type {ApiErrorBody, ApiErrorCode} from '@/core/domain/api';
import type {FetchBudget} from '@/server/tmdb/client';
import {createFetchBudget, UpstreamError} from '@/server/tmdb/client';
import type {CachePolicyName} from './cachePolicy';
import {CACHE_POLICIES, errorCacheControl} from './cachePolicy';
import {RequestError} from './params';

export type RouteName = 'home' | 'discover' | 'search' | 'title' | 'season' | 'person' | 'genres' | 'regions'
  | 'providers' | 'availability' | 'find' | 'legacy-movie' | 'resolve' | 'geo' | 'health' | 'img';

export type ResponseSource = 'upstream' | 'memory' | 'last-good' | 'fixture';

export interface ApiContext {
  request: Request;
  url: URL;
  params: Record<string, string>;
  signal: AbortSignal;
  budget: FetchBudget;
  publicHost: string;
}

export interface ApiResult {
  body: unknown;
  policy: CachePolicyName;
  status?: 200 | 404;
  source?: ResponseSource;
}

export interface ApiOptions {
  deadlineMs: number;
  maxBytes: number;
  cost?: (context: ApiContext) => number;
}

export type ApiHandler = (request: Request, params: Record<string, string>) => Promise<Response>;

export const KB = 1024;

const JSON_TYPE = 'application/json; charset=utf-8';

export interface ApiFailure {
  status: number;
  code: ApiErrorCode;
  message: string;
  retryAfterSeconds?: number;
}

class DeadlineError extends Error {
  constructor() {
    super('The handler deadline passed.');
    this.name = 'DeadlineError';
  }
}

export function publicHost(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-host')?.split(',')[0]?.trim().toLowerCase();
  return forwarded || new URL(SITE_ORIGIN).host;
}

function byteLength(text: string): number {
  return new TextEncoder().encode(text).length;
}

function clampRetry(seconds: number | null | undefined, fallback: number): number {
  const value = seconds ?? fallback;
  return Math.min(60, Math.max(1, Math.round(value)));
}

export function failureFor(error: unknown): ApiFailure {
  if (error instanceof DeadlineError) {
    return {status: 504, code: 'upstream_timeout', message: 'The request took too long.', retryAfterSeconds: 10};
  }
  if (error instanceof RequestError) return {status: error.status, code: error.code, message: error.message};
  if (error instanceof UpstreamError) {
    switch (error.failure) {
      case 'not_found':
        return {status: 404, code: 'not_found', message: 'The resource was not found.'};
      case 'rate_limited':
        return {status: 503, code: 'upstream_rate_limited', message: 'The catalog is rate limited.', retryAfterSeconds: clampRetry(error.retryAfterSeconds, 10)};
      case 'timeout':
        return {status: 504, code: 'upstream_timeout', message: 'The catalog took too long.', retryAfterSeconds: 10};
      default:
        return {status: 502, code: 'upstream_unavailable', message: 'The catalog is unavailable.', retryAfterSeconds: clampRetry(error.retryAfterSeconds, 30)};
    }
  }
  return {status: 500, code: 'internal', message: 'Unexpected server error.', retryAfterSeconds: 30};
}

export function errorResponse(failure: ApiFailure): Response {
  const body: ApiErrorBody = {error: {code: failure.code, message: failure.message}};
  const headers: Record<string, string> = {
    'Content-Type': JSON_TYPE,
    'X-Content-Type-Options': 'nosniff',
    'Cache-Control': errorCacheControl(failure.status),
  };
  if (failure.retryAfterSeconds !== undefined) {
    body.error.retryAfterSeconds = failure.retryAfterSeconds;
    headers['Retry-After'] = String(failure.retryAfterSeconds);
  }
  return new Response(JSON.stringify(body), {status: failure.status, headers});
}

function jsonResponse(status: number, text: string, policy: CachePolicyName, source: ResponseSource): Response {
  return new Response(text, {
    status,
    headers: {
      'Content-Type': JSON_TYPE,
      'X-Content-Type-Options': 'nosniff',
      'Cache-Control': CACHE_POLICIES[policy],
      'X-Yify-Source': source,
    },
  });
}

function log(entry: Record<string, unknown>): void {
  console.log(JSON.stringify(entry));
}

export function withApi(route: RouteName, options: ApiOptions, handler: (context: ApiContext) => Promise<ApiResult>): ApiHandler {
  return async (request, params) => {
    const started = Date.now();
    const controller = new AbortController();
    let expired = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const deadline = new Promise<never>((_, reject) => {
      timer = setTimeout(() => {
        expired = true;
        controller.abort();
        reject(new DeadlineError());
      }, options.deadlineMs);
    });
    const relay = () => controller.abort();
    request.signal?.addEventListener('abort', relay);
    let response: Response;
    let source: ResponseSource | null = null;
    try {
      const context: ApiContext = {
        request,
        url: new URL(request.url),
        params,
        signal: controller.signal,
        budget: createFetchBudget(),
        publicHost: publicHost(request),
      };
      const work = Promise.resolve().then(() => handler(context));
      work.catch(() => undefined);
      const result = await Promise.race([work, deadline]);
      const text = JSON.stringify(result.body);
      if (byteLength(text) > options.maxBytes) {
        log({t: 'api', route, alert: 'oversize', bytes: byteLength(text)});
        response = errorResponse(failureFor(null));
      } else {
        source = result.source ?? 'upstream';
        response = jsonResponse(result.status ?? 200, text, result.policy, source);
      }
    } catch (error) {
      const failure = failureFor(expired ? new DeadlineError() : error);
      if (failure.code === 'internal') log({t: 'api', route, alert: 'internal', error: error instanceof Error ? error.name : 'unknown'});
      response = errorResponse(failure);
    } finally {
      clearTimeout(timer);
      request.signal?.removeEventListener('abort', relay);
    }
    log({t: 'api', route, status: response.status, ms: Date.now() - started, source, colo: request.headers.get('eas-colo')});
    return response;
  };
}

export function preflight(allow: 'GET' | 'POST'): Response {
  return new Response(null, {
    status: 204,
    headers: {
      'Allow': `${allow}, OPTIONS`,
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}
