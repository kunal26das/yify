import {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import type {Movie, MovieRepository} from '@/domain';
import {
    API_MAX_LIMIT,
    HERO_LIMIT,
    HERO_QUERY,
    HOME_SHELVES,
    type HomeShelf,
} from './constants/homeShelves';

export type ShelfStatus = 'idle' | 'loading' | 'loaded' | 'empty' | 'error';

export const MIN_SHELF_MOVIES = 5;

const MAX_SHELF_PAGES = 5;

export interface ShelfState extends HomeShelf {
    movies: Movie[];
    status: ShelfStatus;
    page: number;
    hasMore: boolean;
    needsRequest?: boolean;
}

const SHELF_ORDER = new Map(HOME_SHELVES.map((shelf, i) => [shelf.key, i]));

interface QueuedPage {
    key: string;
    page: number;
}

function takeNextInShelfOrder(queue: QueuedPage[]): QueuedPage | undefined {
    if (queue.length === 0) return undefined;
    const rank = (q: QueuedPage) => (SHELF_ORDER.get(q.key) ?? Number.MAX_SAFE_INTEGER) * 1000 + q.page;
    let best = 0;
    for (let i = 1; i < queue.length; i++) {
        if (rank(queue[i]) < rank(queue[best])) best = i;
    }
    return queue.splice(best, 1)[0];
}

function initialShelves(): ShelfState[] {
    return HOME_SHELVES.map((shelf) => ({...shelf, movies: [], status: 'idle', page: 0, hasMore: true}));
}

export function useHomeViewModel(repository: MovieRepository) {
    const [heroMovies, setHeroMovies] = useState<Movie[]>([]);
    const [heroTrailers, setHeroTrailers] = useState<Record<number, string | null>>({});
    const [heroBackdrops, setHeroBackdrops] = useState<Record<number, string | null>>({});
    const [shelves, setShelves] = useState<ShelfState[]>(initialShelves);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const heroLoadingRef = useRef(false);
    const requestedRef = useRef<Set<string>>(new Set());

    const loadHero = useCallback(async () => {
        if (heroLoadingRef.current) return;
        heroLoadingRef.current = true;
        try {
            const {movies} = await repository.listMovies({page: 1, limit: HERO_LIMIT, ...HERO_QUERY});
            const withArt = movies.filter((m) => m.backgroundImageUrl);
            const heroToShow = withArt.length > 0 ? withArt : movies;
            if (heroToShow.length > 0) {
                setHeroMovies(heroToShow);
                setError(null);
            } else {
                setError('Failed to load movies');
            }
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Failed to load movies');
        } finally {
            heroLoadingRef.current = false;
            setLoading(false);
            setRefreshing(false);
        }
    }, [repository]);

    const trailerAskedRef = useRef<Set<number>>(new Set());
    const requestHeroTrailer = useCallback(
        (movieId: number) => {
            if (trailerAskedRef.current.has(movieId)) return;
            trailerAskedRef.current.add(movieId);
            repository
                .getMovieDetails(movieId)
                .then((details) => {
                    setHeroTrailers((prev) => ({...prev, [movieId]: details.ytTrailerCode || null}));
                    setHeroBackdrops((prev) => ({
                        ...prev,
                        [movieId]: details.screenshotUrls[0] ?? null,
                    }));
                })
                .catch(() => {
                    setHeroTrailers((prev) => ({...prev, [movieId]: null}));
                });
        },
        [repository]
    );

    const inFlightRef = useRef<Set<string>>(new Set());
    const queueRef = useRef<QueuedPage[]>([]);
    const busyRef = useRef(false);

    const runFetch = useCallback(
        (key: string, page: number) => {
            const shelf = HOME_SHELVES.find((s) => s.key === key);
            if (!shelf) return Promise.resolve();
            return repository
                .listMovies({page, limit: API_MAX_LIMIT, ...shelf.query})
                .then((r) => {
                    setShelves((prev) =>
                        prev.map((s) => {
                            if (s.key !== key) return s;
                            const seen = new Set(s.movies.map((m) => m.id));
                            const movies = [...s.movies, ...r.movies.filter((m) => !seen.has(m.id))];
                            return {
                                ...s,
                                movies,
                                page,
                                hasMore: r.hasMore,
                                status: movies.length > 0 ? 'loaded' : 'empty',
                            };
                        })
                    );
                })
                .catch(() => {
                    requestedRef.current.delete(key);
                    setShelves((prev) =>
                        prev.map((s) => (s.key === key && s.page === 0 ? {...s, status: 'error'} : s))
                    );
                });
        },
        [repository]
    );

    const pump = useCallback(() => {
        if (busyRef.current) return;
        const next = takeNextInShelfOrder(queueRef.current);
        if (!next) return;
        busyRef.current = true;
        void runFetch(next.key, next.page).finally(() => {
            busyRef.current = false;
            inFlightRef.current.delete(next.key);
            pump();
        });
    }, [runFetch]);

    const fetchPage = useCallback(
        (key: string, page: number) => {
            if (inFlightRef.current.has(key)) return;
            inFlightRef.current.add(key);
            queueRef.current.push({key, page});
            setShelves((prev) => prev.map((s) => (s.key === key && s.page === 0 ? {...s, status: 'loading'} : s)));
            pump();
        },
        [pump]
    );

    const loadShelf = useCallback(
        (key: string) => {
            if (requestedRef.current.has(key)) return;
            requestedRef.current.add(key);
            fetchPage(key, 1);
        },
        [fetchPage]
    );

    const loadInitial = useCallback(() => {
        void loadHero();
    }, [loadHero]);

    const reload = useCallback(() => {
        setError(null);
        setRefreshing(true);
        requestedRef.current.clear();
        inFlightRef.current.clear();
        queueRef.current = [];
        setShelves(initialShelves());
        void loadHero();
    }, [loadHero]);

    const {shelves: dedupedShelves, needsMore} = useMemo(() => {
        const seen = new Set<number>(heroMovies.map((m) => m.id));
        const more: {key: string; next: number}[] = [];

        let aboveSettled = true;

        const next = shelves.map((shelf) => {
            const available = shelf.movies.filter((m) => !seen.has(m.id));

            const visible = available.slice(0, shelf.limit);
            for (const m of visible) seen.add(m.id);

            const exhausted = !shelf.hasMore || shelf.page >= MAX_SHELF_PAGES;
            const thin =
                shelf.status === 'loaded' && visible.length < MIN_SHELF_MOVIES && !exhausted;
            const own: ShelfStatus = shelf.status === 'loaded' && thin ? 'loading' : shelf.status;
            if (thin && shelf.page > 0) more.push({key: shelf.key, next: shelf.page + 1});

            const settled = own === 'loaded' || own === 'empty' || own === 'error';
            const revealed = aboveSettled;
            aboveSettled = aboveSettled && settled;

            return {
                ...shelf,
                movies: visible,
                status: revealed ? own : 'loading',
                needsRequest: shelf.status === 'idle',
            } as ShelfState;
        });

        return {shelves: next, needsMore: more};
    }, [shelves, heroMovies]);

    useEffect(() => {
        for (const {key, next} of needsMore) fetchPage(key, next);
    }, [needsMore, fetchPage]);

    return {
        heroMovies,
        heroTrailers,
        heroBackdrops,
        requestHeroTrailer,
        shelves: dedupedShelves,
        loading,
        refreshing,
        error,
        loadInitial,
        loadShelf,
        reload,
    };
}

export type HomeViewModel = ReturnType<typeof useHomeViewModel>;
