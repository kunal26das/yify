import type {Diagnostics, KeyValueStore, StreamingAvailability, StreamingCatalog, StreamingOffer, StreamingRepository} from '@/domain';
import {safeStreamingUrl} from '@/domain';
import {ResponseCache} from '../datasources/storage/ResponseCache';
import {NOOP_DIAGNOSTICS} from '../services/NoopDiagnostics';

const DAY = 86_400_000;
const CACHE_KEY = 'availability-v1';
const CATALOG_KEY = 'countries-v1';
const ID = /^[a-z0-9][a-z0-9_.-]{0,79}(?::[a-z0-9][a-z0-9_.-]{0,79})?$/i;

export function streamingBaseUrl(location: Pick<Location, 'origin' | 'hostname' | 'protocol'> | undefined =
    typeof window === 'undefined' ? undefined : window.location): string {
    const local = location && ['localhost', '127.0.0.1', '[::1]'].includes(location.hostname)
        && ['http:', 'https:'].includes(location.protocol);
    const hosted = location?.protocol === 'https:' && (location.hostname === 'yify.expo.app'
        || location.hostname.endsWith('.expo.app'));
    return `${local || hosted ? location!.origin : 'https://yify.expo.app'}/api/streaming`;
}

function record(value: unknown): Record<string, unknown> {
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid availability response');
    return value as Record<string, unknown>;
}

function label(value: unknown, max = 200): string {
    if (typeof value !== 'string' || !value.trim() || value.length > max) throw new Error('Invalid availability label');
    return value;
}

function identifier(value: unknown): string {
    const id = label(value);
    if (!ID.test(id)) throw new Error('Invalid service');
    return id;
}

export function parseStreamingCatalog(value: unknown): StreamingCatalog {
    const input = record(value);
    if (input.status !== 'ready' || !Array.isArray(input.countries) || input.countries.length > 300) {
        throw new Error('Streaming catalog unavailable');
    }
    const seen = new Set<string>();
    const countries = input.countries.map(raw => {
        const country = record(raw);
        const code = label(country.code, 2);
        if (!/^[A-Z]{2}$/.test(code) || seen.has(code) || !Array.isArray(country.services)
            || country.services.length > 1000) throw new Error('Invalid streaming country');
        seen.add(code);
        const services = country.services.map(rawService => {
            const service = record(rawService);
            return {id: identifier(service.id), name: label(service.name),
                ...(service.parentName == null ? {} : {parentName: label(service.parentName)})};
        });
        return {code, name: label(country.name), services};
    });
    return {status: 'ready', countries};
}

export function parseStreamingAvailability(value: unknown, country: string): StreamingAvailability {
    const input = record(value);
    if (input.country !== country || !['ready', 'unsupported-country'].includes(String(input.status))
        || !Array.isArray(input.offers) || input.offers.length > 500) throw new Error('Invalid availability response');
    const offers = input.offers.map(raw => {
        const offer = record(raw);
        const url = safeStreamingUrl(offer.url);
        if (!url || !['subscription', 'addon', 'free', 'rent', 'buy'].includes(String(offer.type))) {
            throw new Error('Invalid streaming offer');
        }
        const serviceId = identifier(offer.serviceId);
        const selectionId = identifier(offer.selectionId);
        if (offer.type === 'addon' ? !selectionId.startsWith(`${serviceId}:`) : selectionId !== serviceId) {
            throw new Error('Invalid service selection');
        }
        return {serviceId, selectionId, serviceName: label(offer.serviceName), url,
            type: offer.type as StreamingOffer['type'],
            ...(offer.addonName == null ? {} : {addonName: label(offer.addonName)}),
            ...(offer.price == null ? {} : {price: label(offer.price, 80)}),
            ...(offer.quality == null ? {} : {quality: label(offer.quality, 40)})};
    });
    if (input.status === 'unsupported-country' && offers.length) throw new Error('Invalid country coverage');
    const checkedAt = typeof input.checkedAt === 'number' && Number.isFinite(input.checkedAt)
        && input.checkedAt > 0 && input.checkedAt <= Date.now() + 60_000 ? input.checkedAt : undefined;
    return {country, status: input.status as 'ready' | 'unsupported-country', offers, checkedAt};
}

export class StreamingRepositoryImpl implements StreamingRepository {
    private readonly responses = new ResponseCache(150);
    private readonly saved = new Map<string, StreamingAvailability>();

    constructor(private readonly store: KeyValueStore, private readonly diagnostics: Diagnostics = NOOP_DIAGNOSTICS,
        private readonly baseUrl = streamingBaseUrl(), private readonly fetcher: typeof fetch = fetch,
        private readonly timeoutMs = 20_000) {
        try {
            const entries: unknown = JSON.parse(this.store.getString(CACHE_KEY) ?? '[]');
            if (Array.isArray(entries)) for (const entry of entries.slice(-100)) {
                if (!Array.isArray(entry) || typeof entry[0] !== 'string' || !/^tt\d{5,12}:[A-Z]{2}$/.test(entry[0])) continue;
                try {
                    const value = parseStreamingAvailability(entry[1], entry[0].split(':')[1]);
                    if (this.fresh(value)) this.saved.set(entry[0], value);
                } catch {}
            }
        } catch {}
    }

    private fresh(value: StreamingAvailability): boolean {
        return value.checkedAt != null && value.checkedAt > Date.now() - DAY && value.checkedAt <= Date.now() + 60_000;
    }

    private async request(path: string): Promise<unknown> {
        const controller = new AbortController();
        let timer: ReturnType<typeof setTimeout> | undefined;
        const deadline = new Promise<never>((_, reject) => {
            timer = setTimeout(() => {controller.abort(); reject(new Error('Availability timed out'));}, this.timeoutMs);
        });
        try {
            return await Promise.race([deadline, (async () => {
                const response = await this.fetcher(`${this.baseUrl}/${path}`, {signal: controller.signal, headers: {Accept: 'application/json'}});
                if (!response.ok) throw new Error(`Availability unavailable (${response.status})`);
                return response.json();
            })()]);
        } finally {
            if (timer !== undefined) clearTimeout(timer);
            controller.abort();
        }
    }

    async getCatalog(): Promise<StreamingCatalog> {
        try {
            return await this.responses.getOrLoad('countries', DAY, async () => {
                try {
                    const saved = record(JSON.parse(this.store.getString(CATALOG_KEY) ?? 'null'));
                    if (typeof saved.at === 'number' && saved.at > Date.now() - DAY && saved.at <= Date.now()) {
                        return parseStreamingCatalog(saved.value);
                    }
                } catch {}
                const value = parseStreamingCatalog(await this.request('countries'));
                try {this.store.set(CATALOG_KEY, JSON.stringify({at: Date.now(), value}));} catch {}
                return value;
            });
        } catch {
            this.diagnostics.event('streaming.catalog', {outcome: 'unavailable'});
            return {status: 'unavailable', countries: []};
        }
    }

    getCachedAvailability(imdbId: string, country: string): StreamingAvailability | null {
        const key = `${imdbId}:${country}`;
        const value = this.saved.get(key);
        if (!value) return null;
        if (!this.fresh(value)) {this.saved.delete(key); return null;}
        return value;
    }

    async getAvailability(imdbId: string, country: string): Promise<StreamingAvailability> {
        const unavailable: StreamingAvailability = {country, status: 'unavailable', offers: []};
        if (!/^tt\d{5,12}$/.test(imdbId) || !/^[A-Z]{2}$/.test(country)) return unavailable;
        const cached = this.getCachedAvailability(imdbId, country);
        if (cached) return cached;
        try {
            const value = await this.responses.getOrLoad(`${imdbId}:${country}`, 60_000, async () => {
                const params = new URLSearchParams({imdbId, country});
                return parseStreamingAvailability(await this.request(`title?${params}`), country);
            });
            if (this.fresh(value)) {
                this.saved.delete(`${imdbId}:${country}`);
                this.saved.set(`${imdbId}:${country}`, value);
                while (this.saved.size > 100) this.saved.delete(this.saved.keys().next().value!);
                try {this.store.set(CACHE_KEY, JSON.stringify([...this.saved]));} catch {}
            }
            return value;
        } catch {
            this.diagnostics.event('streaming.availability', {outcome: 'unavailable', region: country});
            return unavailable;
        }
    }
}
