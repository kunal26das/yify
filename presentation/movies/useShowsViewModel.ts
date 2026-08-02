import {useCallback, useEffect, useRef, useState} from 'react';
import type {Show, ShowRepository} from '@/domain';
import {EZTV_MAX_LIMIT} from '@/data';

export type ShowsStatus = 'loading' | 'ready' | 'empty' | 'unavailable';

export function useShowsViewModel(repository: ShowRepository) {
    const [shows, setShows] = useState<Show[]>([]);
    const [status, setStatus] = useState<ShowsStatus>('loading');
    const [refreshing, setRefreshing] = useState(false);
    const [hasMore, setHasMore] = useState(true);

    const pageRef = useRef(0);
    const loadingRef = useRef(false);
    const seenRef = useRef<Set<string>>(new Set());

    const load = useCallback(
        async (page: number) => {
            if (loadingRef.current) return;
            loadingRef.current = true;
            if (page === 1) setRefreshing(true);

            try {
                const result = await repository.listShows({page, limit: EZTV_MAX_LIMIT});
                pageRef.current = page;

                if (page === 1) seenRef.current = new Set();
                const fresh = result.shows.filter((show) => !seenRef.current.has(show.imdbId));
                for (const show of fresh) seenRef.current.add(show.imdbId);

                setShows((prev) => (page === 1 ? fresh : [...prev, ...fresh]));
                setHasMore(result.hasMore);
                setStatus((prev) => {
                    if (page > 1) return prev === 'unavailable' ? 'ready' : prev;
                    return result.shows.length > 0 ? 'ready' : 'empty';
                });
            } catch {
                if (page === 1) {
                    setShows([]);
                    setStatus('unavailable');
                }
                setHasMore(false);
            } finally {
                loadingRef.current = false;
                setRefreshing(false);
            }
        },
        [repository]
    );

    useEffect(() => {
        void load(1);
    }, [load]);

    const loadMore = useCallback(() => {
        if (!hasMore || loadingRef.current) return;
        void load(pageRef.current + 1);
    }, [hasMore, load]);

    const reload = useCallback(() => {
        setStatus('loading');
        void load(1);
    }, [load]);

    return {shows, status, refreshing, hasMore, loadMore, reload};
}

export type ShowsViewModel = ReturnType<typeof useShowsViewModel>;
