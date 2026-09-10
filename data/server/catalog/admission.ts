import type {CatalogRequest} from './parameters';

interface Bucket {
    tokens: number;
    updatedAt: number;
    active: number;
}

interface CatalogAdmissionOptions {
    now?: () => number;
    clientCapacity?: number;
    clientRefillPerMinute?: number;
    workerCapacity?: number;
    workerRefillPerMinute?: number;
    clientConcurrency?: number;
    workerConcurrency?: number;
    maximumClients?: number;
}

type AdmissionResult = {allowed: true; release: () => void} | {allowed: false; retryAfter: number};

export interface CatalogAdmission {
    acquire(request: Request, catalog: CatalogRequest): AdmissionResult;
}

function clientKey(request: Request): string {
    const value = request.headers.get('X-Real-IP')?.trim();
    if (!value || value.length > 45 || value.includes('%')) return 'unknown';
    if (/^(?:0|[1-9]\d{0,2})(?:\.(?:0|[1-9]\d{0,2})){3}$/.test(value)
        && value.split('.').every(part => Number(part) <= 255)) return value;
    if (value.includes(':') && /^[\da-f:.]+$/i.test(value)) {
        try {
            return new URL(`https://[${value}]/`).hostname;
        } catch {
            return 'unknown';
        }
    }
    return 'unknown';
}

export function createCatalogAdmission(options: CatalogAdmissionOptions = {}): CatalogAdmission {
    const now = options.now ?? Date.now;
    const clientCapacity = options.clientCapacity ?? 60;
    const clientRate = (options.clientRefillPerMinute ?? 60) / 60_000;
    const workerCapacity = options.workerCapacity ?? 240;
    const workerRate = (options.workerRefillPerMinute ?? 240) / 60_000;
    const clientConcurrency = options.clientConcurrency ?? 24;
    const workerConcurrency = options.workerConcurrency ?? 48;
    const maximumClients = options.maximumClients ?? 2048;
    const clients = new Map<string, Bucket>();
    const worker: Bucket = {tokens: workerCapacity, updatedAt: now(), active: 0};

    const refill = (bucket: Bucket, capacity: number, rate: number, time: number) => {
        const elapsed = Math.max(0, time - bucket.updatedAt);
        bucket.tokens = Math.min(capacity, bucket.tokens + elapsed * rate);
        bucket.updatedAt = Math.max(time, bucket.updatedAt);
    };

    return {
        acquire(request, catalog) {
            const time = now();
            const key = clientKey(request);
            const cost = catalog.operation === 'episodes' ? 6 : 1;
            refill(worker, workerCapacity, workerRate, time);
            let client = clients.get(key);
            if (!client) {
                for (const [storedKey, bucket] of clients) {
                    refill(bucket, clientCapacity, clientRate, time);
                    if (bucket.active === 0 && bucket.tokens === clientCapacity) clients.delete(storedKey);
                }
                if (clients.size >= maximumClients) return {allowed: false, retryAfter: 60};
                client = {tokens: clientCapacity, updatedAt: time, active: 0};
                clients.set(key, client);
            }
            refill(client, clientCapacity, clientRate, time);
            const clientWait = (cost - client.tokens) / clientRate;
            const workerWait = (cost - worker.tokens) / workerRate;
            if (clientWait > 0 || workerWait > 0) {
                return {allowed: false, retryAfter: Math.max(1, Math.ceil(Math.max(clientWait, workerWait) / 1000))};
            }
            if (client.active + cost > clientConcurrency || worker.active + cost > workerConcurrency) {
                return {allowed: false, retryAfter: 1};
            }
            client.tokens -= cost;
            worker.tokens -= cost;
            client.active += cost;
            worker.active += cost;
            let released = false;
            return {
                allowed: true,
                release() {
                    if (released) return;
                    released = true;
                    client.active -= cost;
                    worker.active -= cost;
                },
            };
        },
    };
}
