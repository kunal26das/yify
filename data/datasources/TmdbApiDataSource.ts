export const TMDB_BASE_URL = 'https://api.themoviedb.org/3';
export const TMDB_IMAGE_BASE_URL = 'https://image.tmdb.org/t/p';

const REQUEST_TIMEOUT_MS = 10000;

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

export interface TmdbApi {
    findByImdbId(imdbCode: string): Promise<TmdbFindResponse>;

    getWatchProviders(id: number, media: TmdbMediaType): Promise<TmdbWatchProvidersResponse>;
}

export function tmdbImageUrl(path: string | null | undefined, size: string): string | undefined {
    if (!path) return undefined;
    return `${TMDB_IMAGE_BASE_URL}/${size}${path}`;
}

export class TmdbApiDataSource implements TmdbApi {
    constructor(
        private readonly resolveApiKey: () => string | Promise<string>,
        private readonly baseUrl: string = TMDB_BASE_URL
    ) {
    }

    private async request<T>(path: string, params: URLSearchParams): Promise<T> {
        const key = await this.resolveApiKey();
        if (!key) throw new Error('TMDB key unavailable');
        params.set('api_key', key);

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
        try {
            const response = await fetch(`${this.baseUrl}${path}?${params.toString()}`, {
                signal: controller.signal,
            });
            if (!response.ok) throw new Error(`TMDB error: ${response.status}`);
            return (await response.json()) as T;
        } finally {
            clearTimeout(timeoutId);
        }
    }

    async findByImdbId(imdbCode: string): Promise<TmdbFindResponse> {
        return this.request<TmdbFindResponse>(
            `/find/${encodeURIComponent(imdbCode)}`,
            new URLSearchParams({external_source: 'imdb_id'})
        );
    }

    async getWatchProviders(id: number, media: TmdbMediaType): Promise<TmdbWatchProvidersResponse> {
        return this.request<TmdbWatchProvidersResponse>(
            `/${media}/${id}/watch/providers`,
            new URLSearchParams()
        );
    }
}
