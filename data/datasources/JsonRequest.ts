import type {Diagnostics} from '@/domain';

const RETRYABLE_STATUSES = new Set([500, 502, 503, 504]);
const NETWORK_MESSAGES = new Set(['Failed to fetch', 'Network request failed', 'Load failed',
    'NetworkError when attempting to fetch resource.']);

export class RequestTimeoutError extends Error {
    constructor() {
        super('The request timed out.');
        this.name = 'TimeoutError';
    }
}

export class HttpResponseError extends Error {
    constructor(readonly status: number) {
        super(`Request failed (${status}).`);
        this.name = 'HttpResponseError';
    }
}

export class InvalidResponseError extends Error {
    constructor(readonly code: 'invalid_response' | 'upstream_rejected' = 'invalid_response') {
        super(code === 'upstream_rejected' ? 'The provider could not complete the request.' : 'The provider returned an invalid response.');
        this.name = 'InvalidResponseError';
    }
}

function requestErrorCode(error: unknown): string | undefined {
    if (error == null || typeof error !== 'object') return undefined;
    try {
        const code = (error as {code?: unknown}).code;
        return typeof code === 'string' && /^ERR_[A-Z0-9_]{1,64}$/.test(code) ? code : undefined;
    } catch {
        return undefined;
    }
}

function isNetworkFailure(error: unknown): boolean {
    return error instanceof TypeError && NETWORK_MESSAGES.has(error.message);
}

interface JsonRequestOptions<T> {
    diagnostics: Diagnostics;
    operation: string;
    provider: string;
    timeoutMs: number;
    fetcher?: typeof fetch;
    init?: Omit<RequestInit, 'signal' | 'method'>;
    parse: (body: unknown) => T;
}

export async function requestJson<T>(url: string, options: JsonRequestOptions<T>): Promise<T> {
    const span = options.diagnostics.start(options.operation, {provider: options.provider, method: 'GET', cache: 'miss'});
    let status: number | undefined;
    let stage = 'fetch';
    let errorCode: string | undefined;
    let retryCount = 0;
    let expired = false;
    let completed = false;
    let controller = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;
    const timeoutError = new RequestTimeoutError();
    const deadline = new Promise<never>((_, reject) => {
        timer = setTimeout(() => {
            expired = true;
            reject(timeoutError);
            controller.abort();
        }, options.timeoutMs);
    });
    const work = async () => {
        for (;;) {
            status = undefined;
            stage = 'fetch';
            errorCode = undefined;
            let response: Response;
            try {
                response = await (options.fetcher ?? fetch)(url, {...options.init, method: 'GET', signal: controller.signal});
            } catch (error) {
                if (!expired && retryCount === 0 && isNetworkFailure(error)) {
                    controller.abort();
                    controller = new AbortController();
                    retryCount++;
                    continue;
                }
                errorCode = requestErrorCode(error) ?? (isNetworkFailure(error) ? 'network_error' : 'request_failed');
                throw error;
            }
            if (expired) throw timeoutError;
            status = response.status;
            stage = 'response';
            if (!response.ok) {
                if (retryCount === 0 && RETRYABLE_STATUSES.has(status) && !response.headers?.has('Retry-After')) {
                    controller.abort();
                    controller = new AbortController();
                    retryCount++;
                    continue;
                }
                errorCode = `http_${status}`;
                throw new HttpResponseError(status);
            }
            stage = 'decode';
            let body: unknown;
            try {
                body = await response.json();
            } catch (error) {
                errorCode = error instanceof SyntaxError ? 'invalid_json'
                    : requestErrorCode(error) ?? (isNetworkFailure(error) ? 'network_error' : 'body_failed');
                if (!expired && retryCount === 0 && (error instanceof SyntaxError || isNetworkFailure(error))
                    && !response.headers?.has('Retry-After')) {
                    controller.abort();
                    controller = new AbortController();
                    retryCount++;
                    continue;
                }
                throw error;
            }
            if (expired) throw timeoutError;
            stage = 'validate';
            return options.parse(body);
        }
    };
    try {
        const result = await Promise.race([work(), deadline]);
        completed = true;
        span.finish('ok', {status_code: status, retry_count: retryCount});
        return result;
    } catch (error) {
        const attributes = {status_code: status, retry_count: retryCount, stage,
            error_code: errorCode ?? (error instanceof InvalidResponseError ? error.code : 'validation_failed')};
        if (expired) {
            span.finish('timeout', {...attributes, error_code: 'request_timeout'});
            throw timeoutError;
        }
        if (error instanceof Error && (error.name === 'AbortError' || requestErrorCode(error) === 'ERR_FETCH_REQUEST_CANCELED')) {
            span.finish('cancelled', {...attributes, error_code: 'request_cancelled'});
        } else {
            span.fail(error, attributes);
        }
        throw error;
    } finally {
        if (timer !== undefined) clearTimeout(timer);
        if (!completed) controller.abort();
    }
}
