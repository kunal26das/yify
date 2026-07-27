import {OrderBy, SortBy} from './movieFilterOptions';

/** The screens the app can navigate to as a top-level destination. */
export type DestinationKey = 'home' | 'movies' | 'new' | 'my-list';

export interface Destination {
    key: DestinationKey;
    label: string;
    href: string;
}

/**
 * One list shared by the nav, the footer and the landing-page setting, so a destination can't be
 * added in one place and quietly missing from the others.
 */
export const DESTINATIONS: readonly Destination[] = [
    {key: 'home', label: 'Home', href: '/'},
    {key: 'movies', label: 'Movies', href: '/browse'},
    {
        key: 'new',
        label: 'New & Popular',
        href: `/browse?sort_by=${SortBy.DateAdded}&order_by=${OrderBy.Desc}`,
    },
    {key: 'my-list', label: 'My List', href: '/my-list'},
];

export function destinationHref(key: DestinationKey): string {
    return DESTINATIONS.find((d) => d.key === key)?.href ?? '/';
}
