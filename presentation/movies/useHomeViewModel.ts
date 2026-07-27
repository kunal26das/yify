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

// A rail with a handful of posters reads as broken rather than curated, so a shelf that dedupe has
// thinned below this keeps pulling pages instead of rendering.
export const MIN_SHELF_MOVIES = 5;

// Backstop for a shelf whose every page collides with the shelves above it: stop paging rather than
// walk the whole catalogue. In practice the first page is almost always enough.
const MAX_SHELF_PAGES = 5;

export interface ShelfState extends HomeShelf {
    movies: Movie[];
    status: ShelfStatus;
    /** Highest page fetched so far. Pages accumulate into `movies`. */
    page: number;
    hasMore: boolean;
}

function initialShelves(): ShelfState[] {
    return HOME_SHELVES.map((shelf) => ({...shelf, movies: [], status: 'idle', page: 0, hasMore: true}));
}

export function useHomeViewModel(repository: MovieRepository) {
    const [heroMovies, setHeroMovies] = useState<Movie[]>([]);
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

    // Fetch one page of a shelf and append it to whatever that shelf already holds. Guarded per
    // key so the fill effect below can't fire the same page twice while it is in flight.
    const inFlightRef = useRef<Set<string>>(new Set());
    const fetchPage = useCallback(
        (key: string, page: number) => {
            if (inFlightRef.current.has(key)) return;
            const shelf = HOME_SHELVES.find((s) => s.key === key);
            if (!shelf) return;
            inFlightRef.current.add(key);
            setShelves((prev) => prev.map((s) => (s.key === key && s.page === 0 ? {...s, status: 'loading'} : s)));
            repository
                .listMovies({page, limit: API_MAX_LIMIT, ...shelf.query})
                .then((r) => {
                    inFlightRef.current.delete(key);
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
                    inFlightRef.current.delete(key);
                    requestedRef.current.delete(key);
                    setShelves((prev) =>
                        prev.map((s) => (s.key === key && s.page === 0 ? {...s, status: 'error'} : s))
                    );
                });
        },
        [repository]
    );

    // Called when a row scrolls near the viewport, so the home no longer fires every shelf request
    // at once. Idempotent per key (retries on error).
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
        setShelves(initialShelves());
        void loadHero();
    }, [loadHero]);

    // A movie belongs to the first shelf that lists it. Later shelves drop it, so scrolling the
    // home never shows the same title twice. Keyed off HOME_SHELVES order rather than load order,
    // so the result is stable no matter which shelf's request settles first — a shelf that resolves
    // late simply reclaims its titles from the shelves below it.
    //
    // Shelves are never hidden by dedupe. One thinned below MIN_SHELF_MOVIES stays in its loading
    // state and `needsMore` asks for another page, so it fills rather than rendering a stub rail.
    const dedupedShelves = useMemo(() => {
        // The hero counts as the first section: it shows the newest titles, which are exactly what
        // the top of "Just Added" would otherwise repeat a screen later.
        const seen = new Set<number>(heroMovies.map((m) => m.id));
        return shelves.map((shelf) => {
            if (shelf.status !== 'loaded') return shelf;
            const movies = shelf.movies.filter((m) => !seen.has(m.id));
            for (const m of movies) seen.add(m.id);
            const exhausted = !shelf.hasMore || shelf.page >= MAX_SHELF_PAGES;
            const thin = movies.length < MIN_SHELF_MOVIES && !exhausted;
            return {
                ...shelf,
                movies: movies.slice(0, shelf.limit),
                // Keep the skeleton up while the shelf is still filling; once the catalogue is
                // exhausted, show whatever survived rather than dropping the shelf.
                status: thin ? 'loading' : 'loaded',
            } as ShelfState;
        });
    }, [shelves, heroMovies]);

    const needsMore = useMemo(
        () =>
            dedupedShelves
                .filter((s) => s.status === 'loading' && s.page > 0)
                .map((s) => ({key: s.key, next: s.page + 1})),
        [dedupedShelves]
    );

    useEffect(() => {
        for (const {key, next} of needsMore) fetchPage(key, next);
    }, [needsMore, fetchPage]);

    return {
        heroMovies,
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
