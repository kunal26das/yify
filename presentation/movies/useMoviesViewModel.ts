import { useCallback, useEffect, useRef, useState } from 'react';
import type { Genre, Movie, MovieRepository, OrderBy, Quality, SortBy } from '@/domain';

const PAGE_SIZE = 50;
const PAGES_PER_BATCH = 2;
const SEARCH_DEBOUNCE_MS = 400;

export interface MovieFilters {
  quality?: Quality;
  minimum_rating?: number;
  genre?: Genre;
  sort_by?: SortBy;
  order_by?: OrderBy;
}

export const DEFAULT_FILTERS: MovieFilters = {};

export interface UseMoviesOptions {
  initialFilters?: MovieFilters;
  initialQuery?: string;
}

export function useMoviesViewModel(repository: MovieRepository, options?: UseMoviesOptions) {
  const [movies, setMovies] = useState<Movie[]>([]);
  const [totalMovieCount, setTotalMovieCount] = useState<number | null>(null);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQueryState] = useState(options?.initialQuery ?? '');
  const [filters, setFiltersState] = useState<MovieFilters>(options?.initialFilters ?? DEFAULT_FILTERS);
  const [appliedQuery, setAppliedQuery] = useState(options?.initialQuery ?? '');
  const [appliedFilters, setAppliedFilters] = useState<MovieFilters>(options?.initialFilters ?? DEFAULT_FILTERS);

  const loadingRef = useRef(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pageRef = useRef(page);
  const hasMoreRef = useRef(hasMore);
  const appliedQueryRef = useRef(appliedQuery);
  const appliedFiltersRef = useRef(appliedFilters);
  const pendingReloadRef = useRef<{ query: string; filters: MovieFilters } | null>(null);
  const loadMoviesRef = useRef<
    ((batch: number, query: string, activeFilters: MovieFilters) => void) | null
  >(null);

  useEffect(() => {
    pageRef.current = page;
    hasMoreRef.current = hasMore;
  });

  const cancelDebounce = useCallback(() => {
    if (!debounceRef.current) return;
    clearTimeout(debounceRef.current);
    debounceRef.current = null;
  }, []);

  const loadMovies = useCallback(
    async (batch: number, query: string, activeFilters: MovieFilters) => {
      if (loadingRef.current) {
        if (batch === 1) pendingReloadRef.current = { query, filters: activeFilters };
        return;
      }
      loadingRef.current = true;
      setLoading(true);
      if (batch === 1) setRefreshing(true);
      setError(null);

      const trimmed = query.trim();
      if (batch === 1) {
        appliedQueryRef.current = trimmed;
        appliedFiltersRef.current = activeFilters;
        setAppliedQuery(trimmed);
        setAppliedFilters(activeFilters);
      }

      try {
        const firstPage = (batch - 1) * PAGES_PER_BATCH + 1;
        const results = await Promise.all(
          Array.from({ length: PAGES_PER_BATCH }, (_, offset) =>
            repository.listMovies({
              page: firstPage + offset,
              limit: PAGE_SIZE,
              query: trimmed || undefined,
              quality: activeFilters.quality,
              minimum_rating: activeFilters.minimum_rating,
              genre: activeFilters.genre,
              sort_by: activeFilters.sort_by,
              order_by: activeFilters.order_by,
            })
          )
        );

        const seen = new Set<number>();
        const fetched: Movie[] = [];
        for (const result of results) {
          for (const movie of result.movies) {
            if (seen.has(movie.id)) continue;
            seen.add(movie.id);
            fetched.push(movie);
          }
        }

        const last = results[results.length - 1];
        const complete = results.every((result) => result.movies.length > 0);

        setMovies((prev) => (batch === 1 ? fetched : [...prev, ...fetched]));
        setPage(batch);
        setHasMore(complete && last.hasMore);
        setTotalMovieCount(results[0].movieCount);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to load movies');
      } finally {
        loadingRef.current = false;
        setLoading(false);
        if (batch === 1) setRefreshing(false);
        const pending = pendingReloadRef.current;
        if (pending) {
          pendingReloadRef.current = null;
          loadMoviesRef.current?.(1, pending.query, pending.filters);
        }
      }
    },
    [repository]
  );

  useEffect(() => {
    loadMoviesRef.current = loadMovies;
  }, [loadMovies]);

  const loadInitial = useCallback(() => {
    loadMovies(1, appliedQueryRef.current, appliedFiltersRef.current);
  }, [loadMovies]);

  const setSearchQuery = useCallback(
    (value: string) => {
      setSearchQueryState(value);
      cancelDebounce();
      debounceRef.current = setTimeout(() => {
        debounceRef.current = null;
        loadMovies(1, value, appliedFiltersRef.current);
      }, SEARCH_DEBOUNCE_MS);
    },
    [cancelDebounce, loadMovies]
  );

  const submitSearch = useCallback(
    (term: string, next: MovieFilters = DEFAULT_FILTERS) => {
      cancelDebounce();
      setSearchQueryState(term);
      setFiltersState(next);
      loadMovies(1, term, next);
    },
    [cancelDebounce, loadMovies]
  );

  const setFilters = useCallback((next: MovieFilters | ((prev: MovieFilters) => MovieFilters)) => {
    setFiltersState(next);
  }, []);

  const resetDraft = useCallback(() => {
    setFiltersState(appliedFiltersRef.current);
  }, []);

  const applyFilters = useCallback(
    (next: MovieFilters) => {
      setFiltersState(next);
      loadMovies(1, appliedQueryRef.current, next);
    },
    [loadMovies]
  );

  const clearFiltersAndReload = useCallback(() => {
    cancelDebounce();
    setFiltersState(DEFAULT_FILTERS);
    setSearchQueryState('');
    loadMovies(1, '', DEFAULT_FILTERS);
  }, [cancelDebounce, loadMovies]);

  useEffect(() => cancelDebounce, [cancelDebounce]);

  const loadMore = useCallback(() => {
    if (!hasMoreRef.current || loadingRef.current) return;
    loadMovies(pageRef.current + 1, appliedQueryRef.current, appliedFiltersRef.current);
  }, [loadMovies]);

  return {
    movies,
    totalMovieCount,
    loading,
    refreshing,
    error,
    hasMore,
    searchQuery,
    setSearchQuery,
    submitSearch,
    filters,
    setFilters,
    resetDraft,
    appliedQuery,
    appliedFilters,
    applyFilters,
    clearFiltersAndReload,
    loadInitial,
    loadMore,
  };
}

export type MoviesViewModel = ReturnType<typeof useMoviesViewModel>;
