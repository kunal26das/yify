import {Genre, OrderBy, Quality, SortBy} from '@/domain';
import {GENRE_OPTIONS} from './movieFilterLabels';
import type {ShelfQuery} from './homeShelves';

export interface FeedChip {
    key: string;
    label: string;
    query: ShelfQuery;
}

const ALL_CHIP: FeedChip = {
    key: 'all',
    label: 'All',
    query: {sort_by: SortBy.DownloadCount, order_by: OrderBy.Desc},
};

const GENRE_CHIPS: readonly FeedChip[] = GENRE_OPTIONS.filter(
    (option) => option.value !== Genre.All
).map((option) => ({
    key: `genre-${option.value}`,
    label: option.label,
    query: {genre: option.value, sort_by: SortBy.DownloadCount, order_by: OrderBy.Desc},
}));

export const FEED_CHIPS: readonly FeedChip[] = [
    ALL_CHIP,
    {
        key: 'new',
        label: 'New',
        query: {sort_by: SortBy.DateAdded, order_by: OrderBy.Desc},
    },
    {
        key: 'uhd',
        label: '4K',
        query: {quality: Quality.P2160, sort_by: SortBy.DownloadCount, order_by: OrderBy.Desc},
    },
    {
        key: 'top-rated',
        label: 'Top rated',
        query: {sort_by: SortBy.Rating, order_by: OrderBy.Desc, minimum_rating: 7},
    },
    {
        key: 'loved',
        label: 'Most liked',
        query: {sort_by: SortBy.LikeCount, order_by: OrderBy.Desc},
    },
    ...GENRE_CHIPS,
];

export function chipFor(key: string): FeedChip {
    return FEED_CHIPS.find((chip) => chip.key === key) ?? ALL_CHIP;
}
