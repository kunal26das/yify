import {router, useLocalSearchParams} from 'expo-router';
import {useEffect, useMemo, useRef} from 'react';
import {MovieRepositoryImpl, YtsApiDataSource} from '@/data';
import {
  Genre,
  MoviesScreen,
  OrderBy,
  Quality,
  SortBy,
  useMoviesViewModel,
  type MovieFilters,
} from '@/presentation';
import {getApiBaseUrl} from '@/lib/remote-config';

function asEnum<T extends string>(value: string | undefined, allowed: readonly T[]): T | undefined {
  return value != null && (allowed as readonly string[]).includes(value) ? (value as T) : undefined;
}

export default function BrowseRoute() {
  const params = useLocalSearchParams<{
    genre?: string;
    quality?: string;
    minimum_rating?: string;
    sort_by?: string;
    order_by?: string;
    query?: string;
    focus?: string;
  }>();

  const api = useMemo(() => new YtsApiDataSource(getApiBaseUrl), []);
  const repository = useMemo(() => new MovieRepositoryImpl(api), [api]);

  const initialFilters = useMemo<MovieFilters | undefined>(() => {
    const f: MovieFilters = {};
    const genre = asEnum(params.genre, Object.values(Genre));
    if (genre) f.genre = genre;
    const quality = asEnum(params.quality, Object.values(Quality));
    if (quality) f.quality = quality;
    const rating = Number(params.minimum_rating);
    if (params.minimum_rating != null && Number.isFinite(rating)) f.minimum_rating = rating;
    const sortBy = asEnum(params.sort_by, Object.values(SortBy));
    if (sortBy) f.sort_by = sortBy;
    const orderBy = asEnum(params.order_by, Object.values(OrderBy));
    if (orderBy) f.order_by = orderBy;
    return Object.keys(f).length > 0 ? f : undefined;
  }, [params.genre, params.quality, params.minimum_rating, params.sort_by, params.order_by]);

  const viewModel = useMoviesViewModel(repository, {
    initialFilters,
    initialQuery: params.query ?? '',
  });

  const {appliedQuery, appliedFilters} = viewModel;
  const lastSyncedRef = useRef<string | null>(null);
  useEffect(() => {
    const rating = appliedFilters.minimum_rating;
    const next: Record<string, string | undefined> = {
      query: appliedQuery.trim() || undefined,
      genre: appliedFilters.genre,
      quality: appliedFilters.quality || undefined,
      minimum_rating: rating != null && Number.isFinite(rating) ? String(rating) : undefined,
      sort_by: appliedFilters.sort_by,
      order_by: appliedFilters.order_by,
      focus: undefined,
    };
    const serialized = JSON.stringify(next);
    if (lastSyncedRef.current === serialized) return;
    lastSyncedRef.current = serialized;
    router.setParams(next);
  }, [appliedQuery, appliedFilters]);

  return <MoviesScreen viewModel={viewModel} showBack autoFocus={params.focus === '1'} />;
}
