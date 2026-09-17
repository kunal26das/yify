import {StreamingUnavailable} from './http';
import type {StreamingProvider} from './provider';

interface AdmissionBucket {
    startedAt: number;
    count: number;
    active: number;
}

interface StreamingHandlerOptions {
    now?: () => number;
    maximumClientRequestsPerMinute?: number;
    maximumWorkerRequestsPerMinute?: number;
    maximumConcurrentRequests?: number;
    maximumClients?: number;
}

function clientKey(request: Request): string {
    const value = request.headers.get('X-Real-IP')?.trim();
    if (!value || value.length > 45 || !/^[\da-f:.]+$/i.test(value)) return 'unknown';
    return value;
}

export function createStreamingHandler(provider: StreamingProvider, options: StreamingHandlerOptions = {}) {
    const now = options.now ?? Date.now;
    const clients = new Map<string, AdmissionBucket>();
    let windowStart = now();
    let requests = 0;
    let active = 0;
    return async (request: Request, operation: string): Promise<Response> => {
        const headers = new Headers({
            'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'CDN-Cache-Control': 'no-store',
            'X-Content-Type-Options': 'nosniff', 'Access-Control-Allow-Origin': '*', Allow: 'GET, OPTIONS',
        });
        const respond = (body: unknown, status: number) => new Response(JSON.stringify(body), {status, headers});
        if (!['countries', 'title'].includes(operation)) return respond({error: 'Invalid streaming request'}, 400);
        if (request.method !== 'GET' && request.method !== 'OPTIONS') return respond({error: 'Method is not allowed'}, 405);
        if (request.method === 'OPTIONS') {
            const method = request.headers.get('Access-Control-Request-Method');
            if (method && method !== 'GET') return respond({error: 'Method is not allowed'}, 405);
            const requested = request.headers.get('Access-Control-Request-Headers');
            if (requested?.split(',').some(value => !['accept', 'content-type'].includes(value.trim().toLowerCase()))) return respond({error: 'Headers are not allowed'}, 400);
            headers.set('Access-Control-Allow-Methods', 'GET, OPTIONS');
            headers.set('Access-Control-Allow-Headers', 'Accept, Content-Type');
            headers.set('Access-Control-Max-Age', '600');
            return new Response(null, {status: 204, headers});
        }
        let imdbId = '';
        let country = '';
        try {
            const url = new URL(request.url);
            const keys = [...url.searchParams.keys()];
            if (url.search.length > 256 || new Set(keys).size !== keys.length || keys.some(key => operation === 'countries' || !['imdbId', 'country'].includes(key))) throw new Error();
            if (operation === 'title') {
                imdbId = url.searchParams.get('imdbId') ?? '';
                country = (url.searchParams.get('country') ?? '').toUpperCase();
                if (!/^tt\d{1,12}$/.test(imdbId) || !/[1-9]/.test(imdbId) || !/^[A-Z]{2}$/.test(country)) throw new Error();
            }
        } catch {
            return respond({error: 'Invalid streaming request'}, 400);
        }
        const unavailable = () => operation === 'countries' ? {status: 'unavailable', countries: []} : {country, status: 'unavailable', offers: []};
        const time = now();
        if (time - windowStart >= 60_000) {
            windowStart = time;
            requests = 0;
        }
        for (const [key, item] of clients) if (item.active === 0 && time - item.startedAt >= 60_000) clients.delete(key);
        const key = clientKey(request);
        let client = clients.get(key);
        if (!client && clients.size < (options.maximumClients ?? 1024)) {
            client = {startedAt: time, count: 0, active: 0};
            clients.set(key, client);
        }
        if (client && time - client.startedAt >= 60_000) {
            client.startedAt = time;
            client.count = 0;
        }
        if (!client || client.count >= (options.maximumClientRequestsPerMinute ?? 30)
            || requests >= (options.maximumWorkerRequestsPerMinute ?? 120)
            || client.active >= 8 || active >= (options.maximumConcurrentRequests ?? 32)) {
            headers.set('Retry-After', '60');
            return respond(unavailable(), 429);
        }
        if (request.signal.aborted) return respond(unavailable(), 503);
        client.count++;
        client.active++;
        requests++;
        active++;
        try {
            const result = operation === 'countries' ? await provider.getCatalog() : await provider.getAvailability(imdbId, country);
            if (result.status === 'ready') {
                const checkedAt = 'checkedAt' in result ? result.checkedAt : undefined;
                const seconds = operation === 'countries' ? 604800 : Math.max(0, Math.min(86400, Math.floor(((checkedAt ?? now()) + 86_400_000 - now()) / 1000)));
                headers.set('Cache-Control', `public, max-age=${Math.min(300, seconds)}, s-maxage=${seconds}`);
                headers.set('CDN-Cache-Control', `public, max-age=${seconds}`);
            }
            return respond(result, 200);
        } catch (error) {
            const failure = error instanceof StreamingUnavailable ? error : new StreamingUnavailable();
            headers.set('Retry-After', String(failure.retryAfter));
            return respond(unavailable(), failure.status);
        } finally {
            client.active--;
            active--;
        }
    };
}
