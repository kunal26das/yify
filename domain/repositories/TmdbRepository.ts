import type {WatchAvailability} from '@/domain';

export type TitleMedia = 'movie' | 'tv';

export interface TitleArtwork {
    tmdbId: number;
    media: TitleMedia;
    title: string;
    overview?: string;
    posterUrl?: string;
    backdropUrl?: string;
    rating?: number;
}

export interface TmdbRepository {
    findByImdbCode(imdbCode: string): Promise<TitleArtwork | null>;

    getWatchAvailability(
        tmdbId: number,
        media: TitleMedia,
        region: string
    ): Promise<WatchAvailability | null>;
}
