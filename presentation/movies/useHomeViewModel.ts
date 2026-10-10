import {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import type {Movie, MovieRepository} from '@/domain';
import {useReloadOnCatalogAccess} from '../hooks/use-reload-on-catalog-access';
import {
    API_MAX_LIMIT,
    HERO_LIMIT,
    HERO_QUERY,
    HOME_SHELVES,
    type HomeShelf,
} from './constants/homeShelves';
import {createHomeShelfSelector} from './homeShelfSelection';

export {MIN_SHELF_MOVIES} from './homeShelfSelection';

export type ShelfStatus = 'idle' | 'loading' | 'loaded' | 'empty' | 'error';

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
    generation: number;
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
    const [fetchingShelves, setFetchingShelves] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const generationRef = useRef(0);
    const heroLoadingRef = useRef<number | null>(null);
    const requestedRef = useRef<Set<string>>(new Set());

    const loadHero = useCallback(async () => {
        const generation = generationRef.current;
        if (heroLoadingRef.current === generation) return;
        heroLoadingRef.current = generation;
        try {
            const {movies} = await repository.listMovies({page: 1, limit: HERO_LIMIT, ...HERO_QUERY});
            if (generation !== generationRef.current) return;
            const withArt = movies.filter((m) => m.backgroundImageUrl);
            const heroToShow = withArt.length > 0 ? withArt : movies;
            setHeroMovies(heroToShow);
            setError(null);
        } catch (e) {
            if (generation !== generationRef.current) return;
            setError(e instanceof Error ? e.message : 'Failed to load movies');
        } finally {
            if (generation !== generationRef.current) return;
            heroLoadingRef.current = null;
            setLoading(false);
            setRefreshing(false);
        }
    }, [repository]);

    const trailerAskedRef = useRef<Set<number>>(new Set());
    const requestHeroTrailer = useCallback(
        (movieId: number) => {
            if (trailerAskedRef.current.has(movieId)) return;
            trailerAskedRef.current.add(movieId);
            const generation = generationRef.current;
            repository
                .getMovieDetails(movieId)
                .then((details) => {
                    if (generation !== generationRef.current) return;
                    setHeroTrailers((prev) => ({...prev, [movieId]: details.ytTrailerCode || null}));
                    setHeroBackdrops((prev) => ({
                        ...prev,
                        [movieId]: details.screenshotUrls[0] ?? null,
                    }));
                })
                .catch(() => {
                    if (generation !== generationRef.current) return;
                    setHeroTrailers((prev) => ({...prev, [movieId]: null}));
                });
        },
        [repository]
    );

    const inFlightRef = useRef<Set<string>>(new Set());
    const queueRef = useRef<QueuedPage[]>([]);
    const busyRef = useRef<number | null>(null);

    const runFetch = useCallback(
        (key: string, page: number, generation: number) => {
            const shelf = HOME_SHELVES.find((s) => s.key === key);
            if (!shelf) return Promise.resolve();
            return repository
                .listMovies({page, limit: API_MAX_LIMIT, ...shelf.query})
                .then((r) => {
                    if (generation !== generationRef.current) return;
                    setShelves((prev) => generation !== generationRef.current ? prev :
                        prev.map((s) => {
                            if (s.key !== key) return s;
                            const seen = new Set(page === 1 ? [] : s.movies.map((m) => m.id));
                            const movies = [...(page === 1 ? [] : s.movies), ...r.movies.filter((m) => !seen.has(m.id))];
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
                    if (generation !== generationRef.current) return;
                    requestedRef.current.delete(key);
                    setShelves((prev) => generation !== generationRef.current ? prev :
                        prev.map((s) => (s.key === key ? {...s, status: 'error'} : s))
                    );
                });
        },
        [repository]
    );

    const pump = useCallback(function pumpQueue() {
        if (busyRef.current === generationRef.current) return;
        const next = takeNextInShelfOrder(queueRef.current);
        if (!next) return;
        if (next.generation !== generationRef.current) {
            pumpQueue();
            return;
        }
        busyRef.current = next.generation;
        setFetchingShelves(true);
        void runFetch(next.key, next.page, next.generation).finally(() => {
            if (next.generation !== generationRef.current) return;
            busyRef.current = null;
            setFetchingShelves(false);
            inFlightRef.current.delete(next.key);
            pumpQueue();
        });
    }, [runFetch]);

    const fetchPage = useCallback(
        (key: string, page: number) => {
            if (inFlightRef.current.has(key)) return;
            inFlightRef.current.add(key);
            queueRef.current.push({key, page, generation: generationRef.current});
            setShelves((prev) => prev.map((s) => (s.key === key ? {...s, status: 'loading'} : s)));
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
        generationRef.current += 1;
        setError(null);
        setRefreshing(true);
        requestedRef.current.clear();
        inFlightRef.current.clear();
        queueRef.current = [];
        busyRef.current = null;
        setFetchingShelves(false);
        trailerAskedRef.current.clear();
        setShelves((previous) => previous.map((shelf) => ({
            ...shelf, page: 0, hasMore: true, status: 'idle',
        })));
        void loadHero();
    }, [loadHero]);

    const retryShelf = useCallback((key: string, page: number) => {
        requestedRef.current.add(key);
        fetchPage(key, page);
    }, [fetchPage]);

    useReloadOnCatalogAccess(reload, loading || refreshing || fetchingShelves);

    const selectShelves = useMemo(() => createHomeShelfSelector(), []);
    const {shelves: dedupedShelves, needsMore} = useMemo(
        () => selectShelves(shelves, heroMovies),
        [selectShelves, shelves, heroMovies]
    );

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
        retryShelf,
        reload,
    };
}

export type HomeViewModel = ReturnType<typeof useHomeViewModel>;
