import type {Diagnostics, NetworkMonitor} from '@/domain';

const RETRYABLE_STATUSES = new Set([500, 502, 503, 504]);
const NETWORK_MESSAGES = new Set(['Failed to fetch', 'Network request failed', 'Load failed',
    'NetworkError when attempting to fetch resource.', 'fetch failed']);
// Expo wraps the native CodedError in FetchError, dropping its code but retaining
// its message and stack. Match transport failures only, never arbitrary fetch errors.
const EXPO_NETWORK_MESSAGE = /^(?:java\.(?:net|io)\.(?:UnknownHostException|ConnectException|SocketException|SocketTimeoutException|EOFException):\s*)?(?:Unable to resolve host\b|Failed to connect to\b|failed to connect to\b|Connection (?:reset|refused|closed)\b|Socket (?:closed|is closed)\b|timeout$|unexpected end of stream\b|Network is unreachable\b|No route to host\b)/;

export class MovieNotFoundError extends Error {
    constructor() {
        super('This movie is no longer available in the catalog.');
        this.name = 'MovieNotFoundError';
    }
}

export class OfflineRequestError extends Error {
    constructor() {
        super('You are offline. Reconnect and try again.');
        this.name = 'OfflineRequestError';
    }
}

export class RequestTimeoutError extends Error {
    constructor() {
        super('The request timed out.');
        this.name = 'TimeoutError';
    }
}

export class RequestCancelledError extends Error {
    constructor() {
        super('The catalog request was cancelled.');
        this.name = 'AbortError';
    }
}

export class HttpResponseError extends Error {
    constructor(readonly status: number) {
        super(`Request failed (${status}).`);
        this.name = 'HttpResponseError';
    }
}

export class InvalidResponseError extends Error {
    constructor(readonly code: 'invalid_response' | 'upstream_rejected' = 'invalid_response',
        readonly reason?: 'envelope' | 'movie_identity' | 'movie_collections' | 'pagination' | 'parental_guides'
            | 'torrents_count' | 'torrents_collection') {
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
    if (!(error instanceof Error)) return false;
    if (error instanceof TypeError && NETWORK_MESSAGES.has(error.message)) return true;
    return error.message.startsWith('fetch failed: ') && EXPO_NETWORK_MESSAGE.test(error.message.slice(14));
}

function isCancellation(error: unknown): boolean {
    return error instanceof Error && (error.name === 'AbortError' || requestErrorCode(error) === 'ERR_FETCH_REQUEST_CANCELED'
        || error.message === 'fetch failed: Fetch request has been canceled'
        || error.message === 'fetch failed: The operation was aborted.');
}

async function confirmedOffline(network?: NetworkMonitor): Promise<boolean> {
    if (!network) return false;
    try {
        return !(network.refresh ? await network.refresh() : network.isOnline());
    } catch {
        // A failed connectivity check is not evidence that the device is offline.
        return false;
    }
}

interface JsonRequestOptions<T> {
    diagnostics: Diagnostics;
    operation: string;
    provider: string;
    timeoutMs: number;
    fetcher?: typeof fetch;
    init?: Omit<RequestInit, 'signal' | 'method'>;
    signal?: AbortSignal;
    network?: NetworkMonitor;
    missingResource?: 'movie';
    parse: (body: unknown) => T;
}

export async function requestJson<T>(url: string, options: JsonRequestOptions<T>): Promise<T> {
    const span = options.diagnostics.start(options.operation, {provider: options.provider, method: 'GET', cache: 'miss'});
    let status: number | undefined;
    let stage = 'fetch';
    let errorCode: string | undefined;
    let retryCount = 0;
    let expired = false;
    let interrupted = false;
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
    const cancellationError = new RequestCancelledError();
    let rejectCancellation: (error: RequestCancelledError) => void = () => {};
    const cancellation = new Promise<never>((_, reject) => { rejectCancellation = reject; });
    const cancel = () => {
        interrupted = true;
        rejectCancellation(cancellationError);
        controller.abort();
    };
    options.signal?.addEventListener('abort', cancel, {once: true});
    if (options.signal?.aborted) cancel();
    const work = async () => {
        if (options.network?.isOnline() === false && await confirmedOffline(options.network)) throw new OfflineRequestError();
        for (;;) {
            if (interrupted) throw cancellationError;
            if (expired) throw timeoutError;
            status = undefined;
            stage = 'fetch';
            errorCode = undefined;
            let response: Response;
            try {
                response = await (options.fetcher ?? fetch)(url, {...options.init, method: 'GET', signal: controller.signal});
            } catch (error) {
                if (!expired && !interrupted && isNetworkFailure(error) && await confirmedOffline(options.network)) {
                    throw new OfflineRequestError();
                }
                if (!expired && !interrupted && retryCount === 0 && isNetworkFailure(error)) {
                    controller.abort();
                    controller = new AbortController();
                    retryCount++;
                    continue;
                }
                errorCode = requestErrorCode(error) ?? (isNetworkFailure(error) ? 'network_error' : 'request_failed');
                throw error;
            }
            if (interrupted) throw cancellationError;
            if (expired) throw timeoutError;
            status = response.status;
            stage = 'response';
            if (!response.ok) {
                if (status === 404 && options.missingResource === 'movie') throw new MovieNotFoundError();
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
                if (!expired && !interrupted && isNetworkFailure(error) && await confirmedOffline(options.network)) {
                    throw new OfflineRequestError();
                }
                if (!expired && !interrupted && retryCount === 0 && (error instanceof SyntaxError || isNetworkFailure(error))
                    && !response.headers?.has('Retry-After')) {
                    controller.abort();
                    controller = new AbortController();
                    retryCount++;
                    continue;
                }
                throw error;
            }
            if (interrupted) throw cancellationError;
            if (expired) throw timeoutError;
            stage = 'validate';
            return options.parse(body);
        }
    };
    try {
        const result = await Promise.race([work(), deadline, cancellation]);
        completed = true;
        span.finish('ok', {status_code: status, retry_count: retryCount});
        return result;
    } catch (error) {
        const attributes = {status_code: status, retry_count: retryCount, stage,
            validation_reason: error instanceof InvalidResponseError ? error.reason : undefined,
            error_code: errorCode ?? (error instanceof InvalidResponseError ? error.code : 'validation_failed')};
        if (interrupted) {
            span.finish('cancelled', {...attributes, error_code: 'request_cancelled'});
            throw cancellationError;
        }
        if (expired) {
            span.finish('timeout', {...attributes, error_code: 'request_timeout'});
            throw timeoutError;
        }
        if (error instanceof MovieNotFoundError) {
            span.finish('empty', {...attributes, error_code: 'movie_not_found'});
        } else if (error instanceof OfflineRequestError) {
            span.finish('unavailable', {...attributes, error_code: 'network_offline'});
        } else if (isCancellation(error)) {
            span.finish('cancelled', {...attributes, error_code: 'request_cancelled'});
        } else {
            span.fail(error, attributes);
        }
        throw error;
    } finally {
        if (timer !== undefined) clearTimeout(timer);
        options.signal?.removeEventListener('abort', cancel);
        if (!completed) controller.abort();
    }
}
