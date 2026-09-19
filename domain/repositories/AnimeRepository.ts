import type {AnimeCategory, AnimeRelease} from '../entities/AnimeRelease';

export interface ListAnimeParams {
    query?: string;
    category?: AnimeCategory;
}

export interface ListAnimeResult {
    releases: AnimeRelease[];
    /** RSS is a bounded snapshot, not a paginated catalog. */
    limit: number;
}

export interface AnimeRepository {
    listAnime(params: ListAnimeParams, signal?: AbortSignal): Promise<ListAnimeResult>;
}
