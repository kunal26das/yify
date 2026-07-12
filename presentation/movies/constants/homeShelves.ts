import {Genre, OrderBy, Quality, SortBy} from './movieFilterOptions';

export type ShelfVariant = 'standard' | 'ranked';

export interface ShelfQuery {
    quality?: Quality;
    genre?: Genre;
    minimum_rating?: number;
    sort_by?: SortBy;
    order_by?: OrderBy;
}

export interface HomeShelf {
    key: string;
    title: string;
    subtitle?: string;
    variant: ShelfVariant;
    limit: number;
    query: ShelfQuery;
}

export const HERO_QUERY: ShelfQuery = {
    sort_by: SortBy.DownloadCount,
    order_by: OrderBy.Desc,
    minimum_rating: 6,
};
export const HERO_LIMIT = 6;

const RAIL_LIMIT = 50;

export const HOME_SHELVES: readonly HomeShelf[] = [
    {
        key: 'top-10',
        title: 'Top 10 This Week',
        variant: 'ranked',
        limit: 10,
        query: {sort_by: SortBy.DownloadCount, order_by: OrderBy.Desc},
    },
    {
        key: 'top-rated',
        title: 'Critically Acclaimed',
        subtitle: 'The highest-rated titles in the catalog',
        variant: 'standard',
        limit: RAIL_LIMIT,
        query: {sort_by: SortBy.Rating, order_by: OrderBy.Desc, minimum_rating: 7},
    },
    {
        key: 'just-added',
        title: 'Just Added',
        subtitle: 'Fresh from the catalog',
        variant: 'standard',
        limit: RAIL_LIMIT,
        query: {sort_by: SortBy.DateAdded, order_by: OrderBy.Desc},
    },
    {
        key: 'loved',
        title: 'Loved by Viewers',
        variant: 'standard',
        limit: RAIL_LIMIT,
        query: {sort_by: SortBy.LikeCount, order_by: OrderBy.Desc},
    },
    {
        key: 'uhd',
        title: '4K Ultra HD',
        subtitle: 'Pristine 2160p transfers',
        variant: 'standard',
        limit: RAIL_LIMIT,
        query: {quality: Quality.P2160, sort_by: SortBy.DownloadCount, order_by: OrderBy.Desc},
    },
    {
        key: 'genre-action',
        title: 'Action & Adventure',
        variant: 'standard',
        limit: RAIL_LIMIT,
        query: {genre: Genre.Action, sort_by: SortBy.DownloadCount, order_by: OrderBy.Desc},
    },
    {
        key: 'genre-scifi',
        title: 'Sci-Fi & Fantasy',
        variant: 'standard',
        limit: RAIL_LIMIT,
        query: {genre: Genre.SciFi, sort_by: SortBy.DownloadCount, order_by: OrderBy.Desc},
    },
    {
        key: 'genre-comedy',
        title: 'Comedy',
        variant: 'standard',
        limit: RAIL_LIMIT,
        query: {genre: Genre.Comedy, sort_by: SortBy.DownloadCount, order_by: OrderBy.Desc},
    },
    {
        key: 'genre-horror',
        title: 'Horror',
        variant: 'standard',
        limit: RAIL_LIMIT,
        query: {genre: Genre.Horror, sort_by: SortBy.DownloadCount, order_by: OrderBy.Desc},
    },
] as const;
