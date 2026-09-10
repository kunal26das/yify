import type {
    TmdbApi,
    TmdbMediaType,
    TmdbProviderDto,
    TmdbTitleDto,
} from '../datasources/TmdbApiDataSource';
import {tmdbImageUrl} from '../datasources/TmdbApiDataSource';
import type {
    TitleArtwork,
    TmdbRepository,
    WatchAvailability,
    WatchOffer,
    WatchProvider,
    WatchRegion,
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

function toProviders(list: TmdbProviderDto[] | undefined, offer: WatchOffer): WatchProvider[] {
    return (list ?? []).filter((provider) => Number.isSafeInteger(provider.provider_id)
        && provider.provider_id > 0 && typeof provider.provider_name === 'string').map((provider) => ({
        id: provider.provider_id,
        name: provider.provider_name,
        offer,
        logoUrl: tmdbImageUrl(provider.logo_path, LOGO_SIZE),
    }));
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
        const found = await this.api.findByImdbId(imdbCode);
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
        const response = await this.api.getWatchProviders(tmdbId, media);
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
        const response = await this.api.getWatchRegions();
        const seen = new Set<string>();
        return (response.results ?? []).filter((region) => {
            if (!/^[A-Z]{2}$/.test(region.iso_3166_1) || typeof region.english_name !== 'string'
                || !region.english_name.trim() || seen.has(region.iso_3166_1)) return false;
            seen.add(region.iso_3166_1);
            return true;
        }).map((region) => ({code: region.iso_3166_1, name: region.english_name}))
            .sort((a, b) => a.name.localeCompare(b.name));
    }
}
