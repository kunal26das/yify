import {router} from 'expo-router';
import {OrderBy, SortBy} from './movieFilterOptions';

export type DestinationKey = 'home' | 'movies' | 'new' | 'my-list';

export interface Destination {
    key: DestinationKey;
    label: string;
    href: string;
}

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

export function goToDestination(href: string, currentPathname: string): void {
    const [path, query = ''] = href.split('?');
    const target = path || '/';
    if (target !== currentPathname) {
        router.push(href as never);
        return;
    }

    const incoming = new URLSearchParams(query);
    const next: Record<string, string | undefined> = {};
    for (const key of BROWSE_PARAM_KEYS) {
        next[key] = incoming.get(key) ?? undefined;
    }
    router.setParams(next);
}

const BROWSE_PARAM_KEYS = [
    'query',
    'genre',
    'quality',
    'minimum_rating',
    'sort_by',
    'order_by',
    'focus',
] as const;
