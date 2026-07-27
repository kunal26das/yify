import {createContext, useContext, useMemo, type ReactNode} from 'react';
import type {Movie} from '@/domain';

/**
 * Ranks of the titles in the Top 10 shelf, shared with every poster on the screen.
 *
 * Netflix shows the TOP 10 flag wherever a charting title appears — not just inside the chart row —
 * so the rank has to travel outside the shelf that produced it. A context keeps that out of the
 * prop chain, which otherwise would have to thread a rank map through every rail and poster.
 */
const TopTenContext = createContext<ReadonlyMap<number, number>>(new Map());

export function TopTenProvider({movies, children}: {movies: readonly Movie[]; children: ReactNode}) {
    const ranks = useMemo(() => {
        const map = new Map<number, number>();
        movies.slice(0, 10).forEach((movie, i) => map.set(movie.id, i + 1));
        return map;
    }, [movies]);

    return <TopTenContext.Provider value={ranks}>{children}</TopTenContext.Provider>;
}

/** Rank 1-10 if the title is charting, otherwise null. */
export function useTopTenRank(movieId: number): number | null {
    return useContext(TopTenContext).get(movieId) ?? null;
}
