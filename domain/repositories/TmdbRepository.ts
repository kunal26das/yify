import type {WatchAvailability, WatchRegion} from '../entities/WatchProvider';
import type {WatchService} from '../entities/WatchService';

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

    getWatchRegions(): Promise<WatchRegion[]>;

    getWatchServices(region: string): Promise<WatchService[]>;

    getWatchAvailability(
        tmdbId: number,
        media: TitleMedia,
        region: string
    ): Promise<WatchAvailability | null>;
}
