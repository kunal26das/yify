import {useCallback, useEffect, useRef, useState} from 'react';
import type {Show, ShowRepository, TmdbRepository} from '@/domain';
import {Analytics} from '@/presentation/analytics/events';

export type ShowsStatus = 'loading' | 'ready' | 'empty' | 'unavailable';

const MAX_EMPTY_PAGES = 12;

export function useShowsViewModel(repository: ShowRepository, artwork?: TmdbRepository) {
    const [shows, setShows] = useState<Show[]>([]);
    const [status, setStatus] = useState<ShowsStatus>('loading');
    const [refreshing, setRefreshing] = useState(false);
    const [loadingMore, setLoadingMore] = useState(false);
    const [hasMore, setHasMore] = useState(true);

    const pageRef = useRef(0);
    const loadingRef = useRef(false);
    const seenRef = useRef<Set<string>>(new Set());

    const decorate = useCallback(
        async (batch: Show[]) => {
            if (!artwork) return;
            for (const show of batch) {
                if (!show.imdbCode) continue;
                const found = await artwork.findByImdbCode(show.imdbCode);
                const poster = found?.posterUrl ?? found?.backdropUrl;
                if (!poster) continue;
                setShows((prev) =>
                    prev.map((item) =>
                        item.imdbId === show.imdbId
                            ? {...item, thumbnailUrl: poster, title: found?.title || item.title}
                            : item
                    )
                );
            }
        },
        [artwork]
    );

    const load = useCallback(
        async (page: number) => {
            if (loadingRef.current) return;
            loadingRef.current = true;
            if (page === 1) setRefreshing(true);
            else setLoadingMore(true);

            try {
                let current = page;
                let received = 0;

                for (let attempt = 0; attempt <= MAX_EMPTY_PAGES; attempt += 1) {
                    const result = await repository.listShows({page: current});
                    pageRef.current = current;
                    received = result.shows.length;

                    if (current === page && page === 1) seenRef.current = new Set();
                    const fresh = result.shows.filter((show) => !seenRef.current.has(show.imdbId));
                    for (const show of fresh) seenRef.current.add(show.imdbId);

                    setShows((prev) =>
                        current === page && page === 1 ? fresh : [...prev, ...fresh]
                    );
                    if (artwork) void decorate(fresh);
                    setHasMore(result.hasMore);

                    if (current === page && page === 1 && received > 0) {
                        Analytics.showsImpression(received);
                    }

                    if (fresh.length > 0 || !result.hasMore) break;
                    if (attempt === MAX_EMPTY_PAGES) {
                        setHasMore(false);
                        break;
                    }
                    current += 1;
                }

                setStatus((prev) => {
                    if (page > 1) return prev === 'unavailable' ? 'ready' : prev;
                    return received > 0 ? 'ready' : 'empty';
                });
            } catch {
                if (page === 1) {
                    Analytics.showsUnavailable();
                    Analytics.loadError('shows');
                    setShows([]);
                    setStatus('unavailable');
                }
                setHasMore(false);
            } finally {
                loadingRef.current = false;
                if (page === 1) setRefreshing(false);
                else setLoadingMore(false);
            }
        },
        [artwork, decorate, repository]
    );

    useEffect(() => {
        void load(1);
    }, [load]);

    const loadMore = useCallback(() => {
        if (!hasMore || loadingRef.current) return;
        void load(pageRef.current + 1);
    }, [hasMore, load]);

    const reload = useCallback(() => {
        setHasMore(true);
        void load(1);
    }, [load]);

    return {shows, status, refreshing, loadingMore, hasMore, loadMore, reload};
}

export type ShowsViewModel = ReturnType<typeof useShowsViewModel>;
