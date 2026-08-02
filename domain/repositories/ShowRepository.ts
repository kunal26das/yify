import type {Show, ShowEpisode} from '../entities/Show';

export interface ListShowsParams {
    page: number;
    limit?: number;
    imdbId?: string;
}

export interface ListShowsResult {
    shows: Show[];
    pageNumber: number;
    hasMore: boolean;
}

export interface ShowRepository {
    listShows(params: ListShowsParams): Promise<ListShowsResult>;

    listEpisodes(imdbId: string): Promise<ShowEpisode[]>;
}
