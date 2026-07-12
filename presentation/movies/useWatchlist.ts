import {useSyncExternalStore} from 'react';
import type {Movie} from '@/domain';
import {getWatchlistSnapshot, isInWatchlist, subscribeWatchlist} from '@/lib/watchlist';

const EMPTY: Movie[] = [];

export function useWatchlist(): Movie[] {
    return useSyncExternalStore(subscribeWatchlist, getWatchlistSnapshot, () => EMPTY);
}

export function useIsInWatchlist(id: number): boolean {
    return useSyncExternalStore(
        subscribeWatchlist,
        () => isInWatchlist(id),
        () => false
    );
}
