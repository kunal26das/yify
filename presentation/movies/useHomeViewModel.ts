import {useCallback, useRef, useState} from 'react';
import type {Movie, MovieRepository} from '@/domain';
import {HERO_LIMIT, HERO_QUERY, HOME_SHELVES, type HomeShelf} from './constants/homeShelves';

export interface LoadedShelf extends HomeShelf {
    movies: Movie[];
}

export function useHomeViewModel(repository: MovieRepository) {
    const [heroMovies, setHeroMovies] = useState<Movie[]>([]);
    const [shelves, setShelves] = useState<LoadedShelf[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const loadingRef = useRef(false);

    const load = useCallback(async () => {
        if (loadingRef.current) return;
        loadingRef.current = true;

        const heroTask = repository
            .listMovies({page: 1, limit: HERO_LIMIT, ...HERO_QUERY})
            .then((r) => r.movies);

        const shelfTasks = HOME_SHELVES.map((shelf) =>
            repository
                .listMovies({page: 1, limit: shelf.limit, ...shelf.query})
                .then((r) => ({shelf, movies: r.movies}))
        );

        const results = await Promise.allSettled([heroTask, ...shelfTasks]);
        const [heroResult, ...shelfResults] = results;

        let heroToShow: Movie[] = [];
        if (heroResult.status === 'fulfilled') {
            const withArt = heroResult.value.filter((m) => m.backgroundImageUrl);
            heroToShow = withArt.length > 0 ? withArt : heroResult.value;
        }

        const loaded: LoadedShelf[] = [];
        for (const result of shelfResults) {
            if (result.status === 'fulfilled' && result.value.movies.length > 0) {
                loaded.push({...result.value.shelf, movies: result.value.movies});
            }
        }

        if (heroToShow.length > 0) setHeroMovies(heroToShow);
        if (loaded.length > 0) setShelves(loaded);

        if (heroToShow.length > 0 || loaded.length > 0) {
            setError(null);
        } else {
            const reason = results.find((r) => r.status === 'rejected') as
                | PromiseRejectedResult
                | undefined;
            setError(reason?.reason instanceof Error ? reason.reason.message : 'Failed to load movies');
        }

        loadingRef.current = false;
        setLoading(false);
        setRefreshing(false);
    }, [repository]);

    const reload = useCallback(() => {
        if (loadingRef.current) return;
        setError(null);
        setRefreshing(true);
        void load();
    }, [load]);

    return {heroMovies, shelves, loading, refreshing, error, loadInitial: load, reload};
}

export type HomeViewModel = ReturnType<typeof useHomeViewModel>;
