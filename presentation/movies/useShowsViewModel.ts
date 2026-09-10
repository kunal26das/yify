import {useCallback, useEffect, useRef, useState} from 'react';
import type {Show, ShowRepository, TmdbRepository} from '@/domain';
import {Analytics} from '@/presentation/analytics/events';
import {useReloadOnCatalogAccess} from '../hooks/use-reload-on-catalog-access';

export type ShowsStatus = 'loading' | 'ready' | 'empty' | 'unavailable';

const MAX_EMPTY_PAGES = 12;

export function useShowsViewModel(repository: ShowRepository, artwork?: TmdbRepository) {
    const [shows, setShows] = useState<Show[]>([]);
    const [status, setStatus] = useState<ShowsStatus>('loading');
    const [refreshing, setRefreshing] = useState(false);
    const [loadingMore, setLoadingMore] = useState(false);
    const [hasMore, setHasMore] = useState(true);
    const [error, setError] = useState<'refresh' | 'more' | null>(null);
    const [source, setSource] = useState({repository, artwork});

    if (source.repository !== repository || source.artwork !== artwork) {
        setSource({repository, artwork});
        setShows([]);
        setStatus('loading');
        setRefreshing(false);
        setLoadingMore(false);
        setHasMore(true);
        setError(null);
    }

    const pageRef = useRef(0);
    const loadingRef = useRef(false);
    const generationRef = useRef(0);
    const seenRef = useRef<Set<string>>(new Set());

    const decorate = useCallback(
        async (batch: Show[], generation: number) => {
            if (!artwork) return;
            for (const show of batch) {
                if (generation !== generationRef.current) return;
                if (!show.imdbCode) continue;
                try {
                    const found = await artwork.findByImdbCode(show.imdbCode);
                    if (generation !== generationRef.current) return;
                    const poster = found?.posterUrl ?? found?.backdropUrl;
                    if (!poster) continue;
                    setShows((prev) =>
                        prev.map((item) =>
                            item.imdbId === show.imdbId
                                ? {...item, thumbnailUrl: poster, title: found?.title || item.title}
                                : item
                        )
                    );
                } catch {
                }
            }
        },
        [artwork]
    );

    const load = useCallback(
        async (page: number) => {
            if (page > 1 && loadingRef.current) return;
            const generation = page === 1 ? ++generationRef.current : generationRef.current;
            loadingRef.current = true;
            try {
                let current = page;
                const seen = page === 1 ? new Set<string>() : new Set(seenRef.current);

                for (let attempt = 0; attempt <= MAX_EMPTY_PAGES; attempt += 1) {
                    const result = await repository.listShows({page: current});
                    if (generation !== generationRef.current) return;
                    const fresh = result.shows.filter((show) => {
                        if (seen.has(show.imdbId)) return false;
                        seen.add(show.imdbId);
                        return true;
                    });
                    const canContinue = result.hasMore && attempt < MAX_EMPTY_PAGES;
                    if (fresh.length === 0 && canContinue) {
                        current += 1;
                        continue;
                    }

                    pageRef.current = current;
                    seenRef.current = seen;
                    setShows((prev) => page === 1 ? fresh : [...prev, ...fresh]);
                    setHasMore(result.hasMore && (fresh.length > 0 || canContinue));
                    setStatus(seen.size > 0 ? 'ready' : 'empty');
                    if (page === 1 && fresh.length > 0) Analytics.showsImpression(fresh.length);
                    void decorate(fresh, generation);
                    break;
                }
            } catch {
                if (generation !== generationRef.current) return;
                Analytics.loadError('shows');
                if (seenRef.current.size === 0) {
                    Analytics.showsUnavailable();
                    setStatus('unavailable');
                } else {
                    setError(page === 1 ? 'refresh' : 'more');
                }
            } finally {
                if (generation === generationRef.current) {
                    loadingRef.current = false;
                    setRefreshing(false);
                    setLoadingMore(false);
                }
            }
        },
        [decorate, repository]
    );

    useEffect(() => {
        pageRef.current = 0;
        seenRef.current = new Set();
        void load(1);
        return () => {
            generationRef.current += 1;
            loadingRef.current = false;
        };
    }, [load]);

    const loadMore = useCallback(() => {
        if (!hasMore || loadingRef.current) return;
        setError(null);
        setLoadingMore(true);
        void load(pageRef.current + 1);
    }, [hasMore, load]);

    const reload = useCallback(() => {
        setError(null);
        setRefreshing(true);
        setLoadingMore(false);
        if (seenRef.current.size === 0) setStatus('loading');
        void load(1);
    }, [load]);

    useReloadOnCatalogAccess(reload, status === 'loading' || refreshing || loadingMore);

    return {shows, status, refreshing, loadingMore, hasMore, error, loadMore, reload};
}

export type ShowsViewModel = ReturnType<typeof useShowsViewModel>;
