import type {
    TmdbApi,
    TmdbMediaType,
    TmdbProviderDto,
    TmdbTitleDto,
} from '../datasources/TmdbApiDataSource';
import {parseTmdbFindResponse, parseTmdbWatchProvidersResponse, parseTmdbWatchRegionsResponse,
    parseTmdbWatchServicesResponse, tmdbImageUrl} from '../datasources/TmdbApiDataSource';
import type {
    TitleArtwork,
    TmdbRepository,
    WatchAvailability,
    WatchOffer,
    WatchProvider,
    WatchRegion,
    WatchService,
} from '@/domain';

const POSTER_SIZE = 'w500';
const BACKDROP_SIZE = 'w1280';
const LOGO_SIZE = 'w92';

function toArtwork(dto: TmdbTitleDto, media: TmdbMediaType): TitleArtwork {
    return {
        tmdbId: dto.id,
        media,
        title: dto.title ?? dto.name ?? '',
        overview: dto.overview || undefined,
        posterUrl: tmdbImageUrl(dto.poster_path, POSTER_SIZE),
        backdropUrl: tmdbImageUrl(dto.backdrop_path, BACKDROP_SIZE),
        rating: dto.vote_average,
    };
}

function toServices(list: TmdbProviderDto[]): WatchService[] {
    return list.filter((provider) => provider != null && typeof provider === 'object'
        && Number.isSafeInteger(provider.provider_id) && provider.provider_id > 0
        && typeof provider.provider_name === 'string' && provider.provider_name.trim()).map((provider) => ({
        id: provider.provider_id,
        name: provider.provider_name.trim(),
        logoUrl: typeof provider.logo_path === 'string' ? tmdbImageUrl(provider.logo_path, LOGO_SIZE) : undefined,
    }));
}

function toProviders(list: TmdbProviderDto[] | undefined, offer: WatchOffer): WatchProvider[] {
    return toServices(list ?? []).map(provider => ({...provider, offer}));
}

function watchUrl(raw: string | undefined, id: number, media: TmdbMediaType, region: string): string | undefined {
    if (!raw) return undefined;
    try {
        const url = new URL(raw);
        const path = new RegExp(`^/${media}/${id}(?:-[^/]+)?/watch/?$`);
        if (url.protocol !== 'https:' || url.hostname !== 'www.themoviedb.org'
            || url.username || url.password || url.port || !path.test(url.pathname)) return undefined;
        url.search = new URLSearchParams({locale: region}).toString();
        url.hash = '';
        return url.toString();
    } catch {
        return undefined;
    }
}

export class TmdbRepositoryImpl implements TmdbRepository {
    constructor(private readonly api: TmdbApi) {
    }

    async findByImdbCode(imdbCode: string): Promise<TitleArtwork | null> {
        if (!imdbCode) return null;
        const found = parseTmdbFindResponse(await this.api.findByImdbId(imdbCode));
        const movie = (found.movie_results ?? [])[0];
        if (movie) return toArtwork(movie, 'movie');
        const show = (found.tv_results ?? [])[0];
        if (show) return toArtwork(show, 'tv');
        return null;
    }

    async getWatchAvailability(
        tmdbId: number,
        media: TmdbMediaType,
        region: string
    ): Promise<WatchAvailability | null> {
        if (!/^[A-Z]{2}$/.test(region) || !Number.isSafeInteger(tmdbId) || tmdbId <= 0) return null;
        const response = parseTmdbWatchProvidersResponse(await this.api.getWatchProviders(tmdbId, media));
        const results = response.results ?? {};
        const entry = results[region];
        if (!entry) return {region, providers: []};

        const providers = [
            ...toProviders(entry.flatrate, 'stream'),
            ...toProviders(entry.free, 'free'),
            ...toProviders(entry.ads, 'ads'),
            ...toProviders(entry.rent, 'rent'),
            ...toProviders(entry.buy, 'buy'),
        ];

        const seen = new Set<string>();
        const unique = providers.filter((provider) => {
            const key = `${provider.id}:${provider.offer}`;
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
        });

        return {
            region,
            providers: unique,
            url: watchUrl(entry.link, tmdbId, media, region),
        };
    }

    async getWatchRegions(): Promise<WatchRegion[]> {
        const response = parseTmdbWatchRegionsResponse(await this.api.getWatchRegions());
        const seen = new Set<string>();
        return (response.results ?? []).filter((region) => {
            if (region == null || typeof region !== 'object' || !/^[A-Z]{2}$/.test(region.iso_3166_1) || typeof region.english_name !== 'string'
                || !region.english_name.trim() || seen.has(region.iso_3166_1)) return false;
            seen.add(region.iso_3166_1);
            return true;
        }).map((region) => ({code: region.iso_3166_1, name: region.english_name}))
            .sort((a, b) => a.name.localeCompare(b.name));
    }

    async getWatchServices(region: string): Promise<WatchService[]> {
        if (typeof region !== 'string' || !/^[A-Z]{2}$/.test(region)) throw new Error('Invalid watch service region');
        const responses = await Promise.all([
            this.api.getWatchServices(region, 'movie'),
            this.api.getWatchServices(region, 'tv'),
        ]);
        const services = responses.flatMap(response => toServices(parseTmdbWatchServicesResponse(response).results));
        const unique = new Map<number, WatchService>();
        for (const service of services) {
            if (!unique.has(service.id)) unique.set(service.id, service);
        }
        return [...unique.values()].sort((a, b) => a.name.localeCompare(b.name) || a.id - b.id);
    }
}
