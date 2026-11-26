import type {ApiErrorCode} from '@/core/domain/api';

export class ApiError extends Error {
  readonly status: number;
  readonly code: ApiErrorCode;
  readonly retryAfterMs: number | null;

  constructor(status: number, code: ApiErrorCode, retryAfterMs: number | null) {
    super(code);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.retryAfterMs = retryAfterMs;
  }
}

export class NetworkError extends Error {
  constructor() {
    super('network');
    this.name = 'NetworkError';
  }
}

export class TimeoutError extends Error {
  constructor() {
    super('timeout');
    this.name = 'TimeoutError';
  }
}

export class ApiDecodeError extends Error {
  readonly route: string;

  constructor(route: string) {
    super('decode');
    this.name = 'ApiDecodeError';
    this.route = route;
  }
}

const NETWORK_MESSAGES: ReadonlySet<string> = new Set([
  'Failed to fetch',
  'Network request failed',
  'Load failed',
  'NetworkError when attempting to fetch resource.',
  'fetch failed',
]);

const EXPO_NETWORK_MESSAGE = /^(?:java\.(?:net|io)\.(?:UnknownHostException|ConnectException|SocketException|SocketTimeoutException|EOFException):\s*)?(?:Unable to resolve host\b|Failed to connect to\b|failed to connect to\b|Connection (?:reset|refused|closed)\b|Socket (?:closed|is closed)\b|timeout$|unexpected end of stream\b|Network is unreachable\b|No route to host\b)/;

const CANCELLED_MESSAGES: ReadonlySet<string> = new Set([
  'fetch failed: Fetch request has been canceled',
  'fetch failed: The operation was aborted.',
]);

function errorCode(error: Error): string | undefined {
  const code: unknown = Reflect.get(error, 'code');
  return typeof code === 'string' ? code : undefined;
}

export function isTransportFailure(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  if (error instanceof TypeError && NETWORK_MESSAGES.has(error.message)) return true;
  return error.message.startsWith('fetch failed: ') && EXPO_NETWORK_MESSAGE.test(error.message.slice(14));
}

export function isAbortError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return typeof error === 'object' && error !== null && Reflect.get(error, 'name') === 'AbortError';
  }
  return error.name === 'AbortError' || errorCode(error) === 'ERR_FETCH_REQUEST_CANCELED' || CANCELLED_MESSAGES.has(error.message);
}
