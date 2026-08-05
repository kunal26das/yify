import {router, useLocalSearchParams} from 'expo-router';
import Head from 'expo-router/head';
import {useEffect, useMemo, useRef, useState} from 'react';
import {Genre, OrderBy, Quality, SortBy} from '@/domain';
import {
  MoviesScreen,
  useMovieRepository,
  usePreferencesRepository,
  useMoviesViewModel,
  type MovieFilters,
} from '@/presentation';

function asEnum<T extends string>(value: string | undefined, allowed: readonly T[]): T | undefined {
  return value != null && (allowed as readonly string[]).includes(value) ? (value as T) : undefined;
}

function serialize(filters: MovieFilters, query: string): string {
  const rating = filters.minimum_rating;
  return JSON.stringify({
    filters: {
      ...(filters.genre ? {genre: filters.genre} : {}),
      ...(filters.quality ? {quality: filters.quality} : {}),
      ...(rating != null && Number.isFinite(rating) ? {minimum_rating: rating} : {}),
      ...(filters.sort_by ? {sort_by: filters.sort_by} : {}),
      ...(filters.order_by ? {order_by: filters.order_by} : {}),
    },
    query,
  });
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

  const repository = useMovieRepository();
  const preferences = usePreferencesRepository();

  const paramFilters = useMemo<MovieFilters | null>(() => {
    const hasParams =
      params.genre != null ||
      params.quality != null ||
      params.minimum_rating != null ||
      params.sort_by != null ||
      params.order_by != null;
    if (!hasParams) return null;
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
    return f;
  }, [
    params.genre,
    params.quality,
    params.minimum_rating,
    params.sort_by,
    params.order_by,
  ]);

  const [initialFilters] = useState<MovieFilters>(() => {
    if (paramFilters) return paramFilters;
    const defaults = preferences.getBrowseDefaults();
    const seeded: MovieFilters = {};
    const genre = asEnum(defaults.genre, Object.values(Genre));
    if (genre) seeded.genre = genre;
    const quality = asEnum(defaults.quality, Object.values(Quality));
    if (quality) seeded.quality = quality;
    if (defaults.minimum_rating > 0) seeded.minimum_rating = defaults.minimum_rating;
    const sortBy = asEnum(defaults.sort_by, Object.values(SortBy));
    if (sortBy) seeded.sort_by = sortBy;
    const orderBy = asEnum(defaults.order_by, Object.values(OrderBy));
    if (orderBy) seeded.order_by = orderBy;
    return seeded;
  });

  const viewModel = useMoviesViewModel(repository, {
    initialFilters,
    initialQuery: params.query ?? '',
  });

  const {appliedQuery, appliedFilters, submitSearch, applyFilters} = viewModel;

  const incoming = serialize(paramFilters ?? {}, params.query ?? '');
  const lastIncomingRef = useRef<string>(incoming);

  useEffect(() => {
    if (lastIncomingRef.current === incoming) return;
    lastIncomingRef.current = incoming;
    const {filters, query} = JSON.parse(incoming) as {filters: MovieFilters; query: string};
    if (query !== appliedQuery) {
      submitSearch(query);
      return;
    }
    applyFilters(filters);
  }, [incoming, appliedQuery, submitSearch, applyFilters]);

  useEffect(() => {
    const rating = appliedFilters.minimum_rating;
    const query = appliedQuery.trim();
    const echoed = serialize(appliedFilters, query);
    if (lastIncomingRef.current === echoed) return;
    lastIncomingRef.current = echoed;
    router.setParams({
      query: query || undefined,
      genre: appliedFilters.genre,
      quality: appliedFilters.quality || undefined,
      minimum_rating: rating != null && Number.isFinite(rating) ? String(rating) : undefined,
      sort_by: appliedFilters.sort_by,
      order_by: appliedFilters.order_by,
      focus: undefined,
    });
  }, [appliedQuery, appliedFilters]);

  return (
    <>
      <Head>
        <title>Browse Movies — Yify</title>
        <meta
          name="description"
          content="Search and filter thousands of movies by genre, rating and quality on Yify."
        />
      </Head>
      <MoviesScreen viewModel={viewModel} autoFocus={params.focus === '1'} />
    </>
  );
}
