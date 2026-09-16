import type {Diagnostics} from '@/domain';

const RETRYABLE_STATUSES = new Set([502, 503, 504]);

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
            const response = await (options.fetcher ?? fetch)(url, {...options.init, signal: controller.signal});
            if (expired) throw timeoutError;
            status = response.status;
            if (!response.ok) {
                if (retryCount === 0 && RETRYABLE_STATUSES.has(status) && !response.headers?.has('Retry-After')) {
                    controller.abort();
                    controller = new AbortController();
                    retryCount++;
                    continue;
                }
                throw new HttpResponseError(status);
            }
            const body: unknown = await response.json();
            if (expired) throw timeoutError;
            return options.parse(body);
        }
    };
    try {
        const result = await Promise.race([work(), deadline]);
        completed = true;
        span.finish('ok', {status_code: status, retry_count: retryCount});
        return result;
    } catch (error) {
        const attributes = {status_code: status, retry_count: retryCount};
        if (expired) {
            span.finish('timeout', {...attributes, error_code: 'request_timeout'});
            throw timeoutError;
        }
        span.fail(error, attributes);
        throw error;
    } finally {
        if (timer !== undefined) clearTimeout(timer);
        if (!completed) controller.abort();
    }
}
