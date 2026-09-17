import type {Diagnostics, KeyValueStore, StreamingAvailability, StreamingCatalog, StreamingOffer, StreamingRepository,
    TitleMedia, TmdbRepository, WatchOffer, WatchRegion} from '@/domain';
import {ResponseCache} from '../datasources/storage/ResponseCache';
import {NOOP_DIAGNOSTICS} from '../services/NoopDiagnostics';

const DAY = 86_400_000;
const CACHE_KEY = 'tmdb-availability-v1';
const CATALOG_KEY = 'tmdb-catalog-v1';
const REGIONS_KEY = 'tmdb-regions-v1';
const OFFER_TYPES: Record<WatchOffer, StreamingOffer['type']> = {stream: 'subscription', free: 'free', ads: 'ads', rent: 'rent', buy: 'buy'};

function record(value: unknown): Record<string, unknown> {
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid availability response');
    return value as Record<string, unknown>;
}

function label(value: unknown): string {
    if (typeof value !== 'string' || !value.trim() || value.length > 200) throw new Error('Invalid streaming label');
    return value.trim();
}

function serviceId(value: unknown): string {
    if (!Number.isSafeInteger(value) || Number(value) <= 0) throw new Error('Invalid streaming service');
    return 'tmdb:' + value;
}

function optionsUrl(value: unknown, country: string): string | undefined {
    if (typeof value !== 'string') return undefined;
    try {
        const url = new URL(value);
        if (url.protocol !== 'https:' || url.hostname !== 'www.themoviedb.org' || url.username || url.password || url.port
            || !/^\/(movie|tv)\/[1-9]\d*(?:-[^/]+)?\/watch\/?$/.test(url.pathname)
            || url.searchParams.get('locale') !== country) return undefined;
        return url.toString();
    } catch {return undefined;}
}

function fresh(at: unknown): at is number {
    return typeof at === 'number' && Number.isFinite(at) && at > Date.now() - DAY && at <= Date.now() + 60_000;
}

function parseRegions(value: unknown): WatchRegion[] {
    if (!Array.isArray(value) || value.length > 250) throw new Error('Invalid streaming countries');
    const seen = new Set<string>();
    return value.map(raw => {
        const region = record(raw);
        const code = label(region.code);
        if (!/^[A-Z]{2}$/.test(code) || seen.has(code)) throw new Error('Invalid streaming country');
        seen.add(code);
        return {code, name: label(region.name)};
    });
}

function parseServices(values: unknown) {
    if (!Array.isArray(values) || values.length > 2000) throw new Error('Invalid streaming services');
    const seen = new Set<string>();
    return values.map(raw => {
        const service = record(raw);
        const id = serviceId(service.id);
        if (seen.has(id)) throw new Error('Duplicate streaming service');
        seen.add(id);
        return {id, name: label(service.name)};
    });
}

export function parseStreamingAvailability(value: unknown, country: string): StreamingAvailability {
    const input = record(value);
    if (input.country !== country || !['ready', 'unsupported-country'].includes(String(input.status))
        || !Array.isArray(input.offers) || input.offers.length > 1000) throw new Error('Invalid streaming availability');
    const offers = input.offers.map(raw => {
        const offer = record(raw);
        const id = label(offer.serviceId);
        if (!/^tmdb:[1-9]\d*$/.test(id) || !Number.isSafeInteger(Number(id.slice(5))) || offer.selectionId !== id
            || !Object.values(OFFER_TYPES).includes(offer.type as StreamingOffer['type'])) throw new Error('Invalid streaming offer');
        const url = optionsUrl(offer.url, country);
        return {serviceId: id, selectionId: id, serviceName: label(offer.serviceName),
            type: offer.type as StreamingOffer['type'], ...(url ? {url} : {})};
    });
    if (input.status === 'unsupported-country' && offers.length) throw new Error('Invalid country coverage');
    if (!fresh(input.checkedAt)) throw new Error('Expired streaming availability');
    return {country, status: input.status as 'ready' | 'unsupported-country', offers, checkedAt: input.checkedAt};
}

export class StreamingRepositoryImpl implements StreamingRepository {
    private readonly responses = new ResponseCache(150);
    private readonly saved = new Map<string, StreamingAvailability>();

    constructor(private readonly tmdb: TmdbRepository, private readonly store: KeyValueStore,
        private readonly diagnostics: Diagnostics = NOOP_DIAGNOSTICS) {
        try {
            const entries: unknown = JSON.parse(this.store.getString(CACHE_KEY) ?? '[]');
            if (Array.isArray(entries)) for (const entry of entries.slice(-100)) {
                if (!Array.isArray(entry) || typeof entry[0] !== 'string' || !/^tt\d{5,12}:[A-Z]{2}:(auto|movie|tv)$/.test(entry[0])) continue;
                try {this.saved.set(entry[0], parseStreamingAvailability(entry[1], entry[0].split(':')[1]));} catch {}
            }
        } catch {}
    }

    private regions(): Promise<WatchRegion[]> {
        return this.responses.getOrLoad('regions', 0, async () => {
            try {
                const saved = record(JSON.parse(this.store.getString(REGIONS_KEY) ?? 'null'));
                if (fresh(saved.at)) return parseRegions(saved.value);
            } catch {}
            const regions = parseRegions(await this.tmdb.getWatchRegions());
            try {this.store.set(REGIONS_KEY, JSON.stringify({at: Date.now(), value: regions}));} catch {}
            return regions;
        });
    }

    async getCatalog(country: string): Promise<StreamingCatalog> {
        if (!/^[A-Z]{2}$/.test(country)) return {status: 'unavailable', countries: []};
        try {
            return await this.responses.getOrLoad('catalog:' + country, 0, async () => {
                const region = (await this.regions()).find(value => value.code === country);
                if (!region) return {status: 'ready', countries: []};
                try {
                    const saved = record(JSON.parse(this.store.getString(CATALOG_KEY) ?? 'null'));
                    if (saved.country === country && fresh(saved.at)) {
                        return {status: 'ready', countries: [{...region, services: parseServices(saved.services)}]};
                    }
                } catch {}
                const values = await this.tmdb.getWatchServices(country);
                const mapped = parseServices(values);
                try {this.store.set(CATALOG_KEY, JSON.stringify({country, at: Date.now(), services: values}));} catch {}
                return {status: 'ready', countries: [{...region, services: mapped}]};
            });
        } catch {
            this.diagnostics.event('streaming.catalog', {provider: 'tmdb', outcome: 'unavailable', region: country});
            return {status: 'unavailable', countries: []};
        }
    }

    private cached(key: string): StreamingAvailability | null {
        const value = this.saved.get(key);
        if (!value) return null;
        if (!fresh(value.checkedAt)) {this.saved.delete(key); return null;}
        return value;
    }

    getCachedAvailability(imdbId: string, country: string): StreamingAvailability | null {
        return this.cached(imdbId + ':' + country + ':auto');
    }

    async getAvailability(imdbId: string, country: string, media?: TitleMedia): Promise<StreamingAvailability> {
        const unavailable: StreamingAvailability = {country, status: 'unavailable', offers: []};
        if (!/^tt\d{5,12}$/.test(imdbId) || !/^[A-Z]{2}$/.test(country)) return unavailable;
        const key = imdbId + ':' + country + ':' + (media ?? 'auto');
        const cached = this.cached(key);
        if (cached) return cached;
        try {
            const value = await this.responses.getOrLoad('availability:' + key, DAY, async (): Promise<StreamingAvailability> => {
                const supported = (await this.regions()).some(region => region.code === country);
                if (!supported) return {country, status: 'unsupported-country', offers: [], checkedAt: Date.now()};
                const artwork = await this.responses.getOrLoad('imdb:' + imdbId, DAY, () => this.tmdb.findByImdbCode(imdbId));
                if (!artwork || (media && artwork.media !== media)) return {country, status: 'ready', offers: [], checkedAt: Date.now()};
                const availability = await this.tmdb.getWatchAvailability(artwork.tmdbId, artwork.media, country);
                if (!availability || availability.region !== country || !Array.isArray(availability.providers)
                    || availability.providers.length > 1000) throw new Error('Invalid viewing options');
                const url = optionsUrl(availability.url, country);
                const seen = new Set<string>();
                const offers = availability.providers.flatMap(provider => {
                    const id = serviceId(provider.id);
                    const type = OFFER_TYPES[provider.offer];
                    if (!type) throw new Error('Invalid streaming offer type');
                    const key = id + ':' + type;
                    if (seen.has(key)) return [];
                    seen.add(key);
                    return [{serviceId: id, selectionId: id, serviceName: label(provider.name), type, ...(url ? {url} : {})}];
                });
                return {country, status: 'ready', offers, checkedAt: Date.now()};
            });
            this.saved.delete(key);
            this.saved.set(key, value);
            while (this.saved.size > 100) this.saved.delete(this.saved.keys().next().value!);
            try {this.store.set(CACHE_KEY, JSON.stringify([...this.saved]));} catch {}
            return value;
        } catch {
            this.diagnostics.event('streaming.availability', {provider: 'tmdb', outcome: 'unavailable', region: country});
            return unavailable;
        }
    }
}
