import {useCallback} from 'react';
import {router, useNavigation, usePathname} from 'expo-router';
import {OrderBy, SortBy} from './movieFilterOptions';

export type DestinationKey = 'home' | 'movies' | 'shows' | 'my-list';

export interface Destination {
    key: DestinationKey;
    label: string;
    href: string;
    upcoming?: boolean;
}

export const DESTINATIONS: readonly Destination[] = [
    {key: 'home', label: 'Home', href: '/'},
    {key: 'movies', label: 'Movies', href: '/movies'},
    {key: 'shows', label: 'Shows', href: '/shows'},
    {key: 'my-list', label: 'My List', href: '/my-list'},
];

export function destinationHref(key: DestinationKey): string {
    return DESTINATIONS.find((d) => d.key === key)?.href ?? '/';
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

function routeNameForPath(path: string): string {
    return path === '/' ? 'index' : path.replace(/^\/+/, '');
}

function applyParams(query: string): void {
    const incoming = new URLSearchParams(query);
    const next: Record<string, string | undefined> = {};
    for (const key of BROWSE_PARAM_KEYS) {
        next[key] = incoming.get(key) ?? undefined;
    }
    router.setParams(next);
}

export function useGoTo(): (href: string) => void {
    const pathname = usePathname();
    const navigation = useNavigation();

    return useCallback(
        (href: string) => {
            const [path, query = ''] = href.split('?');
            const target = path || '/';

            if (target === pathname) {
                applyParams(query);
                return;
            }

            const routes = navigation.getState()?.routes ?? [];
            const name = routeNameForPath(target);
            if (routes.some((route) => route.name === name)) {
                router.dismissTo(href as never);
                return;
            }

            router.push(href as never);
        },
        [pathname, navigation]
    );
}
