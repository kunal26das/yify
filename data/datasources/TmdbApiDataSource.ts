import {ResponseCache} from './storage/ResponseCache';
import type {Diagnostics, NetworkMonitor} from '@/domain';
import {NOOP_DIAGNOSTICS} from '../services/NoopDiagnostics';
import {requestJson} from './JsonRequest';

export const TMDB_BASE_URL = 'https://api.themoviedb.org/3';
export const TMDB_IMAGE_BASE_URL = 'https://image.tmdb.org/t/p';

const REQUEST_TIMEOUT_MS = 10000;
const RESPONSE_TTL_MS = 10 * 60_000;

export type TmdbMediaType = 'movie' | 'tv';

export interface TmdbTitleDto {
    id: number;
    title?: string;
    name?: string;
    overview?: string;
    poster_path?: string | null;
    backdrop_path?: string | null;
    vote_average?: number;
    release_date?: string;
    first_air_date?: string;
}

export interface TmdbFindResponse {
    movie_results?: TmdbTitleDto[];
    tv_results?: TmdbTitleDto[];
}

export interface TmdbProviderDto {
    provider_id: number;
    provider_name: string;
    logo_path?: string | null;
    display_priority?: number;
}

export interface TmdbProviderRegionDto {
    link?: string;
    flatrate?: TmdbProviderDto[];
    rent?: TmdbProviderDto[];
    buy?: TmdbProviderDto[];
    free?: TmdbProviderDto[];
    ads?: TmdbProviderDto[];
}

export interface TmdbWatchProvidersResponse {
    id?: number;
    results?: Record<string, TmdbProviderRegionDto>;
}

export interface TmdbWatchRegionsResponse {
    results?: {iso_3166_1: string; english_name: string}[];
}

export interface TmdbApi {
    findByImdbId(imdbCode: string): Promise<TmdbFindResponse>;

    getWatchProviders(id: number, media: TmdbMediaType): Promise<TmdbWatchProvidersResponse>;

    getWatchRegions(): Promise<TmdbWatchRegionsResponse>;

    getWatchServices(region: string, media: TmdbMediaType): Promise<{results: TmdbProviderDto[]}>;
}

function responseRecord(value: unknown): Record<string, unknown> {
    if (value == null || typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid TMDB response');
    const record = value as Record<string, unknown>;
    if (record.success === false) throw new Error('Invalid TMDB response');
    return record;
}

function parseTmdbListResponse<T>(value: unknown): {results: T[]} {
    const response = responseRecord(value);
    if (!Array.isArray(response.results)) throw new Error('Invalid TMDB results');
    return {results: response.results as T[]};
}

function isProvider(value: unknown): value is TmdbProviderDto {
    if (value == null || typeof value !== 'object' || Array.isArray(value)) return false;
    const provider = value as TmdbProviderDto;
    return Number.isSafeInteger(provider.provider_id) && provider.provider_id > 0
        && typeof provider.provider_name === 'string' && provider.provider_name.trim().length > 0;
}

export function parseTmdbWatchServicesResponse(value: unknown): {results: TmdbProviderDto[]} {
    const response = parseTmdbListResponse<unknown>(value);
    const results = response.results.filter(isProvider);
    if (response.results.length > 0 && results.length === 0) throw new Error('Invalid TMDB services');
    return {results};
}

export function parseTmdbWatchRegionsResponse(value: unknown): TmdbWatchRegionsResponse {
    const response = parseTmdbListResponse<unknown>(value);
    const results = response.results.filter((region): region is {iso_3166_1: string; english_name: string} => {
        if (region == null || typeof region !== 'object' || Array.isArray(region)) return false;
        const entry = region as Record<string, unknown>;
        return typeof entry.iso_3166_1 === 'string' && /^[A-Z]{2}$/.test(entry.iso_3166_1)
            && typeof entry.english_name === 'string' && entry.english_name.trim().length > 0;
    });
    if (response.results.length > 0 && results.length === 0) throw new Error('Invalid TMDB regions');
    return {results};
}

export function parseTmdbFindResponse(value: unknown): TmdbFindResponse {
    const response = responseRecord(value);
    if (!Array.isArray(response.movie_results) && !Array.isArray(response.tv_results)) throw new Error('Invalid TMDB title results');
    for (const list of [response.movie_results, response.tv_results]) {
        if (list === undefined) continue;
        if (!Array.isArray(list) || list.some(title => {
            if (title == null || typeof title !== 'object' || Array.isArray(title)) return true;
            return !Number.isSafeInteger(title.id) || title.id <= 0
                || (title.title !== undefined && typeof title.title !== 'string')
                || (title.name !== undefined && typeof title.name !== 'string');
        })) throw new Error('Invalid TMDB title results');
    }
    return response as TmdbFindResponse;
}

export function parseTmdbWatchProvidersResponse(value: unknown): TmdbWatchProvidersResponse {
    const response = responseRecord(value);
    const regions = responseRecord(response.results);
    for (const value of Object.values(regions)) {
        const region = responseRecord(value);
        for (const offer of ['flatrate', 'free', 'ads', 'rent', 'buy']) {
            const providers = region[offer];
            if (providers !== undefined && (!Array.isArray(providers)
                || (providers.length > 0 && !providers.some(isProvider)))) throw new Error('Invalid TMDB providers');
        }
    }
    return response as TmdbWatchProvidersResponse;
}

export function tmdbImageUrl(path: string | null | undefined, size: string): string | undefined {
    if (!path) return undefined;
    return `${TMDB_IMAGE_BASE_URL}/${size}${path}`;
}

export class TmdbApiDataSource implements TmdbApi {
    private readonly responses = new ResponseCache();

    constructor(
        private readonly resolveApiKey: () => string | Promise<string>,
        private readonly baseUrl: string = TMDB_BASE_URL,
        private readonly diagnostics: Diagnostics = NOOP_DIAGNOSTICS,
        private readonly network?: NetworkMonitor,
    ) {
    }

    private async request<T>(path: string, params: URLSearchParams, operation: string,
        parse: (body: unknown) => T): Promise<T> {
        const key = await this.resolveApiKey();
        if (!key) {
            this.diagnostics.event(operation, {provider: 'tmdb', outcome: 'unavailable'});
            throw new Error('TMDB key unavailable');
        }
        params.set('api_key', key);
        const url = `${this.baseUrl}${path}?${params.toString()}`;
        return this.responses.getOrLoad(url, RESPONSE_TTL_MS, () => this.fetchResponse(url, operation, parse),
            cache => this.diagnostics.event('api.tmdb.cache', {provider: 'tmdb', cache}));
    }

    private fetchResponse<T>(url: string, operation: string, parse: (body: unknown) => T): Promise<T> {
        return requestJson(url, {
            diagnostics: this.diagnostics, operation, provider: 'tmdb', timeoutMs: REQUEST_TIMEOUT_MS, network: this.network,
            parse,
        });
    }

    async findByImdbId(imdbCode: string): Promise<TmdbFindResponse> {
        return this.request<TmdbFindResponse>(
            `/find/${encodeURIComponent(imdbCode)}`,
            new URLSearchParams({external_source: 'imdb_id'}), 'api.tmdb.find', parseTmdbFindResponse,
        );
    }

    async getWatchProviders(id: number, media: TmdbMediaType): Promise<TmdbWatchProvidersResponse> {
        return this.request<TmdbWatchProvidersResponse>(
            `/${media}/${id}/watch/providers`,
            new URLSearchParams(), 'api.tmdb.watch_providers', parseTmdbWatchProvidersResponse,
        );
    }

    async getWatchRegions(): Promise<TmdbWatchRegionsResponse> {
        return this.request<TmdbWatchRegionsResponse>(
            '/watch/providers/regions',
            new URLSearchParams({language: 'en-US'}), 'api.tmdb.watch_regions', parseTmdbWatchRegionsResponse,
        );
    }

    async getWatchServices(region: string, media: TmdbMediaType): Promise<{results: TmdbProviderDto[]}> {
        if (typeof region !== 'string' || !/^[A-Z]{2}$/.test(region)
            || !['movie', 'tv'].includes(media)) throw new Error('Invalid watch service region');
        return this.request(
            `/watch/providers/${media}`,
            new URLSearchParams({language: 'en-US', watch_region: region}), 'api.tmdb.watch_services', parseTmdbWatchServicesResponse,
        );
    }
}
