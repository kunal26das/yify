import {createContext, useContext, useMemo, type ReactNode} from 'react';
import type {Movie} from '@/domain';

const TopTenContext = createContext<ReadonlyMap<number, number>>(new Map());

export function TopTenProvider({movies, children}: {movies: readonly Movie[]; children: ReactNode}) {
    const ranks = useMemo(() => {
        const map = new Map<number, number>();
        movies.slice(0, 10).forEach((movie, i) => map.set(movie.id, i + 1));
        return map;
    }, [movies]);

    return <TopTenContext.Provider value={ranks}>{children}</TopTenContext.Provider>;
}

export function useTopTenRank(movieId: number): number | null {
    return useContext(TopTenContext).get(movieId) ?? null;
}
