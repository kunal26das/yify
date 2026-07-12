import { useCallback, useEffect, useRef, useState } from 'react';
import type { Movie, MovieRepository } from '@/domain';
import {
  Quality,
  type Genre,
  type OrderBy,
  type SortBy,
} from './constants/movieFilterOptions';

const PAGE_SIZE = 50;
const SEARCH_DEBOUNCE_MS = 400;

export interface MovieFilters {
  quality?: Quality;
  minimum_rating?: number;
  genre?: Genre;
  sort_by?: SortBy;
  order_by?: OrderBy;
}

export const DEFAULT_FILTERS: MovieFilters = { quality: Quality.P2160 };

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
  const searchQueryRef = useRef(searchQuery);
  const filtersRef = useRef(filters);
  const pageRef = useRef(page);
  const hasMoreRef = useRef(hasMore);
  const appliedFiltersRef = useRef(appliedFilters);
  const pendingReloadRef = useRef<{ query?: string; filterOverrides?: MovieFilters } | null>(null);
  const loadMoviesRef = useRef<
    ((pageToLoad: number, query?: string, filterOverrides?: MovieFilters) => void) | null
  >(null);

  useEffect(() => {
    searchQueryRef.current = searchQuery;
    filtersRef.current = filters;
    pageRef.current = page;
    hasMoreRef.current = hasMore;
    appliedFiltersRef.current = appliedFilters;
  });

  const loadMovies = useCallback(
    async (
      pageToLoad: number,
      query?: string,
      filterOverrides?: MovieFilters
    ) => {
      if (loadingRef.current) {
        if (pageToLoad === 1) pendingReloadRef.current = { query, filterOverrides };
        return;
      }
      loadingRef.current = true;
      setLoading(true);
      if (pageToLoad === 1) setRefreshing(true);
      setError(null);

      const activeFilters = filterOverrides ?? filtersRef.current;
      if (pageToLoad === 1) {
        setAppliedQuery(query?.trim() ?? '');
        setAppliedFilters(activeFilters);
      }

      try {
        const result = await repository.listMovies({
          page: pageToLoad,
          limit: PAGE_SIZE,
          query: query?.trim() || undefined,
          quality: activeFilters.quality,
          minimum_rating: activeFilters.minimum_rating,
          genre: activeFilters.genre,
          sort_by: activeFilters.sort_by,
          order_by: activeFilters.order_by,
        });

        setMovies((prev) =>
          pageToLoad === 1 ? result.movies : [...prev, ...result.movies]
        );
        setPage(pageToLoad);
        setHasMore(result.hasMore);
        setTotalMovieCount(result.movieCount);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to load movies');
      } finally {
        loadingRef.current = false;
        setLoading(false);
        if (pageToLoad === 1) setRefreshing(false);
        const pending = pendingReloadRef.current;
        if (pending) {
          pendingReloadRef.current = null;
          loadMoviesRef.current?.(1, pending.query, pending.filterOverrides);
        }
      }
    },
    [repository]
  );

  useEffect(() => {
    loadMoviesRef.current = loadMovies;
  }, [loadMovies]);

  const loadInitial = useCallback(() => {
    loadMovies(1, searchQueryRef.current);
  }, [loadMovies]);

  const setSearchQuery = useCallback((value: string) => {
    setSearchQueryState(value);
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
      debounceRef.current = null;
    }
    debounceRef.current = setTimeout(() => {
      debounceRef.current = null;
      loadMovies(1, value);
    }, SEARCH_DEBOUNCE_MS);
  }, [loadMovies]);

  const setFilters = useCallback((next: MovieFilters | ((prev: MovieFilters) => MovieFilters)) => {
    setFiltersState(next);
  }, []);

  const applyFilters = useCallback((override?: MovieFilters) => {
    const active = override ?? filtersRef.current;
    if (override != null) {
      setFiltersState(active);
      filtersRef.current = active;
    }
    loadMovies(1, searchQueryRef.current, active);
  }, [loadMovies]);

  const clearFiltersAndReload = useCallback(() => {
    setFiltersState(DEFAULT_FILTERS);
    filtersRef.current = DEFAULT_FILTERS;
      if (debounceRef.current) {
          clearTimeout(debounceRef.current);
          debounceRef.current = null;
      }
      setSearchQueryState('');
      searchQueryRef.current = '';
      loadMovies(1, '', DEFAULT_FILTERS);
  }, [loadMovies]);

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  const loadMore = useCallback(() => {
    if (!hasMoreRef.current || loadingRef.current) return;
    const nextPage = pageRef.current + 1;
    loadMovies(nextPage, searchQueryRef.current, appliedFiltersRef.current);
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
    filters,
    setFilters,
    appliedQuery,
    appliedFilters,
    applyFilters,
    clearFiltersAndReload,
    loadInitial,
    loadMore,
  };
}

export type MoviesViewModel = ReturnType<typeof useMoviesViewModel>;
