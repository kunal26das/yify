import {useSyncExternalStore} from 'react';
import type {Movie} from '@/domain';
import {useWatchlistRepository} from '../di/DependenciesContext';

const EMPTY: Movie[] = [];

export function useWatchlist(): Movie[] {
    const watchlist = useWatchlistRepository();
    return useSyncExternalStore(
        (listener) => watchlist.subscribe(listener),
        () => watchlist.getAll(),
        () => EMPTY
    );
}

export function useToggleWatchlist(): (movie: Movie) => boolean {
    const watchlist = useWatchlistRepository();
    return (movie: Movie) => watchlist.toggle(movie);
}

export function useIsInWatchlist(id: number): boolean {
    const watchlist = useWatchlistRepository();
    return useSyncExternalStore(
        (listener) => watchlist.subscribe(listener),
        () => watchlist.contains(id),
        () => false
    );
}
