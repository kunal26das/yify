import {useCallback, useRef, useState} from 'react';
import type {Movie, MovieRepository} from '@/domain';
import {HERO_LIMIT, HERO_QUERY, HOME_SHELVES, type HomeShelf} from './constants/homeShelves';

export type ShelfStatus = 'idle' | 'loading' | 'loaded' | 'empty' | 'error';

export interface ShelfState extends HomeShelf {
    movies: Movie[];
    status: ShelfStatus;
}

function initialShelves(): ShelfState[] {
    return HOME_SHELVES.map((shelf) => ({...shelf, movies: [], status: 'idle'}));
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

    // Fetch a shelf's movies on demand — called when its row scrolls near the viewport, so the
    // home no longer fires every shelf request at once. Idempotent per key (retries on error).
    const loadShelf = useCallback(
        (key: string) => {
            if (requestedRef.current.has(key)) return;
            const shelf = HOME_SHELVES.find((s) => s.key === key);
            if (!shelf) return;
            requestedRef.current.add(key);
            setShelves((prev) => prev.map((s) => (s.key === key ? {...s, status: 'loading'} : s)));
            repository
                .listMovies({page: 1, limit: shelf.limit, ...shelf.query})
                .then((r) =>
                    setShelves((prev) =>
                        prev.map((s) =>
                            s.key === key
                                ? {...s, movies: r.movies, status: r.movies.length > 0 ? 'loaded' : 'empty'}
                                : s
                        )
                    )
                )
                .catch(() => {
                    requestedRef.current.delete(key);
                    setShelves((prev) => prev.map((s) => (s.key === key ? {...s, status: 'error'} : s)));
                });
        },
        [repository]
    );

    const loadInitial = useCallback(() => {
        void loadHero();
    }, [loadHero]);

    const reload = useCallback(() => {
        setError(null);
        setRefreshing(true);
        requestedRef.current.clear();
        setShelves(initialShelves());
        void loadHero();
    }, [loadHero]);

    return {heroMovies, shelves, loading, refreshing, error, loadInitial, loadShelf, reload};
}

export type HomeViewModel = ReturnType<typeof useHomeViewModel>;
