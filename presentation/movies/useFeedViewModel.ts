import {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import type {Movie, MovieRepository} from '@/domain';
import {FEED_CHIPS, chipFor} from './constants/feedChips';
import {API_MAX_LIMIT, HERO_LIMIT, HERO_QUERY} from './constants/homeShelves';

const DEFAULT_CHIP_KEY = FEED_CHIPS[0].key;

function hasBackdrop(movie: Movie): boolean {
    return (movie.thumbnailUrls?.length ?? 0) > 0 || !!movie.backgroundImageUrl;
}

function appendUnseen(existing: Movie[], incoming: Movie[]): Movie[] {
    const seen = new Set(existing.map((movie) => movie.id));
    const fresh: Movie[] = [];
    for (const movie of incoming) {
        if (seen.has(movie.id)) continue;
        seen.add(movie.id);
        fresh.push(movie);
    }
    return fresh.length > 0 ? [...existing, ...fresh] : existing;
}

export interface FeedViewModelOptions {
    skipHero?: boolean;
}

export function useFeedViewModel(repository: MovieRepository, options?: FeedViewModelOptions) {
    const skipHero = options?.skipHero ?? false;
    const [hero, setHero] = useState<Movie[]>([]);
    const [chip, setChipState] = useState(DEFAULT_CHIP_KEY);
    const [fetched, setFetched] = useState<Movie[]>([]);
    const [totalCount, setTotalCount] = useState<number | null>(null);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [hasMore, setHasMore] = useState(true);

    const heroLoadingRef = useRef(false);
    const loadingRef = useRef(false);
    const hasMoreRef = useRef(true);
    const pageRef = useRef(0);
    const chipRef = useRef(DEFAULT_CHIP_KEY);
    const pendingChipRef = useRef<string | null>(null);
    const startedRef = useRef(false);
    const loadPageRef = useRef<((page: number, chipKey: string) => void) | null>(null);

    const loadHero = useCallback(async () => {
        if (skipHero || heroLoadingRef.current) return;
        heroLoadingRef.current = true;
        try {
            const {movies} = await repository.listMovies({
                page: 1,
                limit: HERO_LIMIT,
                ...HERO_QUERY,
            });
            const withArt = movies.filter(hasBackdrop);
            setHero(withArt.length > 0 ? withArt : movies);
        } catch {
            setHero([]);
        } finally {
            heroLoadingRef.current = false;
        }
    }, [repository, skipHero]);

    const loadPage = useCallback(
        async (pageToLoad: number, chipKey: string) => {
            if (loadingRef.current) {
                if (pageToLoad === 1) pendingChipRef.current = chipKey;
                return;
            }
            loadingRef.current = true;
            setLoading(true);
            if (pageToLoad === 1) setRefreshing(true);
            setError(null);

            try {
                const result = await repository.listMovies({
                    page: pageToLoad,
                    limit: API_MAX_LIMIT,
                    ...chipFor(chipKey).query,
                });
                if (chipKey !== chipRef.current) return;
                setFetched((prev) =>
                    pageToLoad === 1 ? appendUnseen([], result.movies) : appendUnseen(prev, result.movies)
                );
                pageRef.current = pageToLoad;
                hasMoreRef.current = result.hasMore;
                setHasMore(result.hasMore);
                setTotalCount(Number.isFinite(result.movieCount) ? result.movieCount : null);
            } catch (e) {
                setError(e instanceof Error ? e.message : 'Failed to load movies');
            } finally {
                loadingRef.current = false;
                setLoading(false);
                if (pageToLoad === 1) setRefreshing(false);
                const pendingChip = pendingChipRef.current;
                if (pendingChip !== null) {
                    pendingChipRef.current = null;
                    loadPageRef.current?.(1, pendingChip);
                }
            }
        },
        [repository]
    );

    useEffect(() => {
        loadPageRef.current = (page, chipKey) => {
            void loadPage(page, chipKey);
        };
    }, [loadPage]);

    const setChip = useCallback(
        (key: string) => {
            if (key === chipRef.current) return;
            chipRef.current = key;
            pageRef.current = 0;
            hasMoreRef.current = true;
            setChipState(key);
            setFetched([]);
            setTotalCount(null);
            setHasMore(true);
            void loadPage(1, key);
        },
        [loadPage]
    );

    const loadInitial = useCallback(() => {
        if (startedRef.current) return;
        startedRef.current = true;
        void loadHero();
        void loadPage(1, chipRef.current);
    }, [loadHero, loadPage]);

    const loadMore = useCallback(() => {
        if (!hasMoreRef.current || loadingRef.current) return;
        void loadPage(pageRef.current + 1, chipRef.current);
    }, [loadPage]);

    const reload = useCallback(() => {
        pageRef.current = 0;
        hasMoreRef.current = true;
        setError(null);
        setRefreshing(true);
        setHasMore(true);
        void loadHero();
        void loadPage(1, chipRef.current);
    }, [loadHero, loadPage]);

    const movies = useMemo(() => {
        if (hero.length === 0) return fetched;
        const heroIds = new Set(hero.map((movie) => movie.id));
        return fetched.filter((movie) => !heroIds.has(movie.id));
    }, [fetched, hero]);

    return {
        hero,
        chip,
        setChip,
        movies,
        totalCount,
        loading,
        refreshing,
        error,
        hasMore,
        loadInitial,
        loadMore,
        reload,
    };
}

export type FeedViewModel = ReturnType<typeof useFeedViewModel>;
