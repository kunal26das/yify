import type {TmdbApi, TmdbMediaType, TmdbProviderDto, TmdbTitleDto} from '@/data';
import {tmdbImageUrl} from '../datasources/TmdbApiDataSource';
import type {
    TitleArtwork,
    TmdbRepository,
    WatchAvailability,
    WatchOffer,
    WatchProvider,
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
    return (list ?? []).map((provider) => ({
        id: provider.provider_id,
        name: provider.provider_name,
        offer,
        logoUrl: tmdbImageUrl(provider.logo_path, LOGO_SIZE),
    }));
}

export class TmdbRepositoryImpl implements TmdbRepository {
    constructor(private readonly api: TmdbApi) {
    }

    async findByImdbCode(imdbCode: string): Promise<TitleArtwork | null> {
        if (!imdbCode) return null;
        try {
            const found = await this.api.findByImdbId(imdbCode);
            const movie = (found.movie_results ?? [])[0];
            if (movie) return toArtwork(movie, 'movie');
            const show = (found.tv_results ?? [])[0];
            if (show) return toArtwork(show, 'tv');
            return null;
        } catch {
            return null;
        }
    }

    async getWatchAvailability(
        tmdbId: number,
        media: TmdbMediaType,
        region: string
    ): Promise<WatchAvailability | null> {
        try {
            const response = await this.api.getWatchProviders(tmdbId, media);
            const results = response.results ?? {};
            const entry = results[region];
            if (!entry) return null;

            const providers = [
                ...toProviders(entry.flatrate, 'stream'),
                ...toProviders(entry.free, 'stream'),
                ...toProviders(entry.ads, 'stream'),
                ...toProviders(entry.rent, 'rent'),
                ...toProviders(entry.buy, 'buy'),
            ];

            const seen = new Set<number>();
            const unique = providers.filter((provider) => {
                if (seen.has(provider.id)) return false;
                seen.add(provider.id);
                return true;
            });

            if (unique.length === 0) return null;
            return {
                region,
                providers: unique,
            };
        } catch {
            return null;
        }
    }
}
