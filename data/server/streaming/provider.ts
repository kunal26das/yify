import type {StreamingAvailability, StreamingCatalog} from '@/domain';
import {fetchStreamingJson, StreamingUnavailable} from './http';
import {normalizeStreamingCatalog, normalizeStreamingOffers} from './normalization';
import type {StreamingCatalogData} from './normalization';

const DAY = 86_400_000;

interface StreamingProviderOptions {
    apiKey: () => string | undefined;
    fetcher?: typeof fetch;
    now?: () => number;
    timeoutMs?: number;
    maximumCacheEntries?: number;
    maximumCacheBytes?: number;
    maximumConcurrentRequests?: number;
    maximumRequestsPerDay?: number;
}

export interface StreamingProvider {
    getCatalog(): Promise<StreamingCatalog>;
    getAvailability(imdbId: string, country: string): Promise<StreamingAvailability>;
}

export function createStreamingProvider(options: StreamingProviderOptions): StreamingProvider {
    const fetcher = options.fetcher ?? fetch;
    const now = options.now ?? Date.now;
    const maximumCacheEntries = Math.max(1, options.maximumCacheEntries ?? 512);
    const maximumCacheBytes = Math.max(1, options.maximumCacheBytes ?? 4_000_000);
    const maximumConcurrentRequests = options.maximumConcurrentRequests ?? 4;
    const maximumRequestsPerDay = options.maximumRequestsPerDay ?? 25;
    const cache = new Map<string, {expiresAt: number; value: unknown; bytes: number}>();
    let cachedBytes = 0;
    const pending = new Map<string, Promise<unknown>>();
    let active = 0;
    let budgetDay = -1;
    let requests = 0;
    let cooldownUntil = 0;
    let cooldownStatus = 503;

    const apiKey = () => {
        const key = options.apiKey()?.trim();
        if (!key || key.length > 1024 || /\s/.test(key)) throw new StreamingUnavailable();
        return key;
    };

    const evict = (id: string) => {
        cachedBytes -= cache.get(id)?.bytes ?? 0;
        cache.delete(id);
    };

    const memo = async <T>(id: string, lifetime: number, load: () => Promise<T>): Promise<T> => {
        apiKey();
        const found = cache.get(id);
        if (found && found.expiresAt > now()) {
            cache.delete(id);
            cache.set(id, found);
            return found.value as T;
        }
        if (found) evict(id);
        const existing = pending.get(id);
        if (existing) return existing as Promise<T>;
        if (pending.size >= maximumConcurrentRequests + 1) throw new StreamingUnavailable(429, 5);
        const task = Promise.resolve().then(load).then(value => {
            for (const [key, entry] of cache) if (entry.expiresAt <= now()) evict(key);
            const bytes = new TextEncoder().encode(JSON.stringify(value, (_key, item) => item instanceof Map ? [...item.entries()] : item)).byteLength;
            if (bytes <= maximumCacheBytes) {
                while (cache.size >= maximumCacheEntries || cachedBytes + bytes > maximumCacheBytes) evict(cache.keys().next().value!);
                cache.set(id, {value, expiresAt: now() + lifetime, bytes});
                cachedBytes += bytes;
            }
            return value;
        }).finally(() => pending.delete(id));
        pending.set(id, task);
        return task;
    };

    const request = async (path: string, maximumBytes: number) => {
        const key = apiKey();
        const time = now();
        if (cooldownUntil > time) throw new StreamingUnavailable(cooldownStatus, Math.ceil((cooldownUntil - time) / 1000));
        const day = Math.floor(time / DAY);
        if (budgetDay !== day) {
            budgetDay = day;
            requests = 0;
        }
        if (requests >= maximumRequestsPerDay) throw new StreamingUnavailable(429, Math.ceil(((day + 1) * DAY - time) / 1000));
        if (active >= maximumConcurrentRequests) throw new StreamingUnavailable(429, 5);
        active++;
        requests++;
        try {
            return await fetchStreamingJson(fetcher, path, key, options.timeoutMs ?? 8_000, maximumBytes);
        } catch (error) {
            const failure = error instanceof StreamingUnavailable ? error : new StreamingUnavailable(502);
            cooldownUntil = Math.max(cooldownUntil, now() + failure.retryAfter * 1000);
            cooldownStatus = failure.status;
            throw failure;
        } finally {
            active--;
        }
    };

    const catalog = () => memo<StreamingCatalogData>('countries', 7 * DAY, async () => {
        const value = await request('countries', 4_000_000);
        try {
            return normalizeStreamingCatalog(value);
        } catch {
            cooldownUntil = Math.max(cooldownUntil, now() + 60_000);
            cooldownStatus = 502;
            throw new StreamingUnavailable(502);
        }
    });

    return {
        async getCatalog() {
            return (await catalog()).catalog;
        },
        async getAvailability(imdbId, country) {
            const available = await catalog();
            if (!available.catalog.countries.some(item => item.code === country)) return {country, status: 'unsupported-country', offers: []};
            return memo<StreamingAvailability>(`${country}:${imdbId}`, DAY, async () => {
                const value = await request(`shows/${encodeURIComponent(imdbId)}?country=${country.toLowerCase()}&series_granularity=show`, 1_000_000);
                try {
                    const offers = value === null ? [] : normalizeStreamingOffers(value, country, available);
                    return {country, status: 'ready', offers, checkedAt: now()};
                } catch {
                    cooldownUntil = Math.max(cooldownUntil, now() + 60_000);
                    cooldownStatus = 502;
                    throw new StreamingUnavailable(502);
                }
            });
        },
    };
}
