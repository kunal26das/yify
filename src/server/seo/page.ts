import type {ImmutableRequest} from 'expo-router/server';
import {traceEnabled} from '@/server/env';
import {notFoundHtml} from './notFoundHtml';
import {ENFORCED_CSP} from './securityHeaders';

export type PageRequest = ImmutableRequest | undefined;
export type PageParams = Record<string, string | string[]>;

const ID_PATTERN = /^(\d{1,9})(?:-[a-z0-9-]*)?$/;

export function isLoaderDataRequest(request: PageRequest): boolean {
  return request?.headers.get('accept')?.includes('application/json') ?? false;
}

export function publicHost(request: PageRequest): string | null {
  return request?.headers.get('x-forwarded-host') ?? null;
}

export function parseIdParam(params: PageParams): {id: number; raw: string} | null {
  const value = params.id;
  const raw = Array.isArray(value) ? value.join('/') : value ?? '';
  const match = ID_PATTERN.exec(raw);
  if (!match) return null;
  const id = Number(match[1]);
  return id > 0 ? {id, raw} : null;
}

export function notFoundResponse(kind: 'title' | 'person'): Response {
  return new Response(notFoundHtml(kind), {
    status: 404,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'public, max-age=300, s-maxage=3600',
      'X-Robots-Tag': 'noindex',
      'Content-Security-Policy': ENFORCED_CSP,
      'X-Content-Type-Options': 'nosniff',
    },
  });
}

export function redirectResponse(path: string): Response {
  return new Response(null, {status: 301, headers: {Location: path}});
}

export function loaderDataResponse(): Response {
  return Response.json(null, {headers: {'Cache-Control': 'no-store'}});
}

export function signalOf(request: PageRequest): AbortSignal {
  return request?.signal ?? new AbortController().signal;
}

export function trace(fn: string, request: PageRequest, extra: Record<string, unknown> = {}): void {
  if (!traceEnabled()) return;
  const url = request ? new URL(request.url) : null;
  console.log(JSON.stringify({t: 's1', fn, path: url?.pathname ?? null, accept: request?.headers.get('accept') ?? null, ...extra}));
}
