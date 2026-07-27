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
    /**
     * Display status. A shelf below one that is still settling reads as `loading` even when its own
     * request has already come back — see the dedupe pass for why.
     */
    status: ShelfStatus;
    /** Highest page fetched so far. Pages accumulate into `movies`. */
    page: number;
    hasMore: boolean;
    /** True while the shelf has asked for nothing yet, regardless of what `status` displays. */
    needsRequest?: boolean;
}

/** Position of each shelf on the home, used to serve queued requests top-down. */
const SHELF_ORDER = new Map(HOME_SHELVES.map((shelf, i) => [shelf.key, i]));

interface QueuedPage {
    key: string;
    page: number;
}

/**
 * Removes and returns the queued request belonging to the highest shelf on the page, earliest page
 * first within a shelf. Ties can't happen — a shelf is only ever queued once at a time.
 */
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
    // Trailer ids for hero slides, filled in one slide at a time. `null` marks a title we asked
    // about and that turned out to have no trailer, so it is never requested again.
    const [heroTrailers, setHeroTrailers] = useState<Record<number, string | null>>({});
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

    // The list endpoint doesn't carry trailer ids, so the hero asks for the details of whichever
    // slide is showing. Requested lazily (never for all ten at once) and only once per title.
    const trailerAskedRef = useRef<Set<number>>(new Set());
    const requestHeroTrailer = useCallback(
        (movieId: number) => {
            if (trailerAskedRef.current.has(movieId)) return;
            trailerAskedRef.current.add(movieId);
            repository
                .getMovieDetails(movieId)
                .then((details) =>
                    setHeroTrailers((prev) => ({...prev, [movieId]: details.ytTrailerCode || null}))
                )
                .catch(() => {
                    // A failed lookup shouldn't retry on every slide change; the backdrop stands in.
                    setHeroTrailers((prev) => ({...prev, [movieId]: null}));
                });
        },
        [repository]
    );

    // Shelf requests run one at a time, always in shelf order.
    //
    // Every rail asks for its own page as it nears the viewport, and the refill pass below can ask
    // for several more at once. Fired in parallel that is a burst of requests against an API that
    // rate-limits, and the rails settle in whatever order the network happened to return.
    //
    // The queue is served by position on the page rather than by who asked first, so scrolling
    // ahead can't make a lower rail jump the shelves above it: the home always fills top-down.
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
                    // Drop the key from `requested` so the row can ask again on a later pass.
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

    // Queue one page of a shelf. Guarded per key so the refill pass below can't enqueue the same
    // shelf twice while its request is still outstanding.
    const fetchPage = useCallback(
        (key: string, page: number) => {
            if (inFlightRef.current.has(key)) return;
            inFlightRef.current.add(key);
            queueRef.current.push({key, page});
            // Show the skeleton as soon as the shelf joins the queue, not when its turn comes up,
            // so a waiting rail doesn't read as an empty gap.
            setShelves((prev) => prev.map((s) => (s.key === key && s.page === 0 ? {...s, status: 'loading'} : s)));
            pump();
        },
        [pump]
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
        // Drop anything still waiting its turn; those requests describe the shelves we just reset.
        // A request already in flight is left to settle — its `finally` only restarts the pump.
        queueRef.current = [];
        setShelves(initialShelves());
        void loadHero();
    }, [loadHero]);

    // A movie belongs to the first shelf that *shows* it. Later shelves drop it, so scrolling the
    // home never shows the same title twice. Keyed off HOME_SHELVES order rather than load order,
    // so the result is stable no matter which shelf's request settles first — a shelf that resolves
    // late simply reclaims its titles from the shelves below it.
    //
    // Shelves are never hidden by dedupe. One thinned below MIN_SHELF_MOVIES stays in its loading
    // state and `needsMore` asks for another page, so it fills rather than rendering a stub rail.
    const {shelves: dedupedShelves, needsMore} = useMemo(() => {
        // The hero counts as the first section: it shows the newest titles, which are exactly what
        // the top of "Just Added" would otherwise repeat a screen later.
        const seen = new Set<number>(heroMovies.map((m) => m.id));
        const more: {key: string; next: number}[] = [];

        // Goes false at the first shelf that hasn't finished settling; every shelf after it is
        // held back. See the reveal gate below.
        let aboveSettled = true;

        const next = shelves.map((shelf) => {
            const available = shelf.movies.filter((m) => !seen.has(m.id));

            // Claim only the titles this rail actually renders. Claiming everything it fetched
            // would bury the rest: a shelf asks for 50 and the Top 10 shows ten, so forty of the
            // most-downloaded titles in the catalogue would be struck off every shelf below
            // without ever appearing on screen.
            const visible = available.slice(0, shelf.limit);
            for (const m of visible) seen.add(m.id);

            // The shelf's own state, ignoring anything above it. A shelf thinned below
            // MIN_SHELF_MOVIES by dedupe is not done: it goes back to loading and asks for
            // another page rather than rendering a stub rail.
            const exhausted = !shelf.hasMore || shelf.page >= MAX_SHELF_PAGES;
            const thin =
                shelf.status === 'loaded' && visible.length < MIN_SHELF_MOVIES && !exhausted;
            const own: ShelfStatus = shelf.status === 'loaded' && thin ? 'loading' : shelf.status;
            if (thin && shelf.page > 0) more.push({key: shelf.key, next: shelf.page + 1});

            const settled = own === 'loaded' || own === 'empty' || own === 'error';
            const revealed = aboveSettled;
            aboveSettled = aboveSettled && settled;

            // A shelf shows its titles only once every shelf above it is final.
            //
            // Serialising the requests is not enough on its own: a shelf is only discovered to be
            // thin after its page renders, so the queue has already moved on to the next shelf by
            // the time the refill is asked for. That refill then lands after the shelf below has
            // drawn, reclaims titles from it, and the lower rail's contents visibly jump. Holding
            // the reveal until everything above is settled means a rail's contents are final the
            // moment they appear.
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
