import {infiniteQueryOptions, keepPreviousData, queryOptions} from '@tanstack/react-query';
import {decodeHomeResponse} from '@/core/api/decode';
import {
  fetchDiscover,
  fetchFind,
  fetchGenres,
  fetchGeo,
  fetchHome,
  fetchLegacyMovie,
  fetchPerson,
  fetchProviders,
  fetchRegions,
  fetchSearch,
  fetchSeason,
  fetchTitle,
  loadAvailability,
  normalizeSearchQuery,
} from '@/core/api/endpoints';
import type {DiscoverResponse, HomeResponse, SearchResponse} from '@/core/domain/api';
import type {PersonKey, TitleKey} from '@/core/domain/keys';
import type {Region, RegionCode} from '@/core/domain/providers';
import type {DiscoverParams, SearchType} from '@/core/domain/search';
import type {Genre} from '@/core/domain/title';
import {readValue, writeValue} from '@/core/storage/json';
import type {HomeCache, ReferenceCache} from '@/core/storage/keys';
import {CODECS, KEY_PREFIXES, KEYS} from '@/core/storage/keys';
import {kv} from '@/core/storage/kv';
import {queryKeys} from './keys';

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

export interface QueryTimes {
  staleTime: number;
  gcTime: number;
}

export const QUERY_TIMES = {
  home: {staleTime: 15 * MINUTE, gcTime: DAY},
  discover: {staleTime: 10 * MINUTE, gcTime: 30 * MINUTE},
  search: {staleTime: 10 * MINUTE, gcTime: 30 * MINUTE},
  title: {staleTime: 30 * MINUTE, gcTime: HOUR},
  season: {staleTime: 30 * MINUTE, gcTime: HOUR},
  person: {staleTime: HOUR, gcTime: HOUR},
  genres: {staleTime: DAY, gcTime: Infinity},
  regions: {staleTime: DAY, gcTime: Infinity},
  providers: {staleTime: DAY, gcTime: DAY},
  availability: {staleTime: 6 * HOUR, gcTime: 6 * HOUR},
  find: {staleTime: Infinity, gcTime: DAY},
  legacyMovie: {staleTime: Infinity, gcTime: DAY},
  geo: {staleTime: 7 * DAY, gcTime: Infinity},
} as const satisfies Record<string, QueryTimes>;

export const HOME_SNAPSHOT_REGIONS = 2;
export const SEARCH_MIN_LENGTH = 2;

function attempt<T>(work: () => T): T | null {
  try {
    return work();
  } catch {
    return null;
  }
}

export function readHomeSnapshot(region: RegionCode): HomeCache | null {
  const cached = attempt(() => readValue(kv, KEYS.homeCache(region), CODECS.homeCache));
  if (cached === null || cached.data.region !== region) return null;
  const data = attempt(() => decodeHomeResponse(cached.data));
  return data === null ? null : {savedAt: cached.savedAt, data};
}

export function writeHomeSnapshot(data: HomeResponse, now: number = Date.now()): void {
  if (attempt(() => writeValue(kv, KEYS.homeCache(data.region), CODECS.homeCache, {savedAt: now, data})) !== true) return;
  const saved: {key: string; savedAt: number}[] = [];
  for (const key of kv.keys()) {
    if (!key.startsWith(KEY_PREFIXES.homeCache)) continue;
    const cached = attempt(() => readValue(kv, key, CODECS.homeCache));
    saved.push({key, savedAt: cached?.savedAt ?? -1});
  }
  saved.sort((a, b) => b.savedAt - a.savedAt);
  for (const {key} of saved.slice(HOME_SNAPSHOT_REGIONS)) kv.remove(key);
}

export function readReferenceSnapshot(): ReferenceCache | null {
  return attempt(() => readValue(kv, KEYS.referenceCache, CODECS.referenceCache));
}

function writeReferenceSnapshot(patch: {genres?: Genre[]; regions?: Region[]}, now: number = Date.now()): void {
  const current = readReferenceSnapshot();
  const genres = patch.genres ?? current?.genres ?? [];
  const regions = patch.regions ?? current?.regions ?? [];
  const keepsOlderList = (patch.genres === undefined && genres.length > 0) || (patch.regions === undefined && regions.length > 0);
  const next: ReferenceCache = {
    savedAt: current !== null && keepsOlderList ? Math.min(current.savedAt, now) : now,
    genres,
    regions,
  };
  attempt(() => writeValue(kv, KEYS.referenceCache, CODECS.referenceCache, next));
}

function nonEmpty<T>(items: readonly T[] | undefined): items is readonly T[] {
  return items !== undefined && items.length > 0;
}

function once<T>(read: () => T): () => T {
  let value: {current: T} | null = null;
  return () => {
    value ??= {current: read()};
    return value.current;
  };
}

export function homeQueryOptions(region: RegionCode) {
  const snapshot = once(() => readHomeSnapshot(region));
  return queryOptions({
    queryKey: queryKeys.home(region),
    queryFn: async ({signal}) => {
      const data = await fetchHome(region, signal);
      writeHomeSnapshot(data);
      return data;
    },
    initialData: () => snapshot()?.data,
    initialDataUpdatedAt: () => snapshot()?.savedAt,
    ...QUERY_TIMES.home,
  });
}

export function discoverQueryOptions(params: DiscoverParams) {
  return infiniteQueryOptions({
    queryKey: queryKeys.discover(params),
    queryFn: ({pageParam, signal}) => fetchDiscover(params, pageParam, signal),
    initialPageParam: 1,
    getNextPageParam: (last: DiscoverResponse) => (last.page < last.totalPages ? last.page + 1 : undefined),
    placeholderData: keepPreviousData,
    ...QUERY_TIMES.discover,
  });
}

export function searchQueryOptions(q: string, type: SearchType) {
  const query = normalizeSearchQuery(q);
  return infiniteQueryOptions({
    queryKey: queryKeys.search(query, type),
    queryFn: ({pageParam, signal}) => fetchSearch(query, type, pageParam, signal),
    initialPageParam: 1,
    getNextPageParam: (last: SearchResponse) => (last.page < last.totalPages ? last.page + 1 : undefined),
    placeholderData: keepPreviousData,
    enabled: query.length >= SEARCH_MIN_LENGTH,
    ...QUERY_TIMES.search,
  });
}

export function titleQueryOptions(key: TitleKey, region: RegionCode) {
  return queryOptions({
    queryKey: queryKeys.title(key, region),
    queryFn: ({signal}) => fetchTitle(key, region, signal),
    ...QUERY_TIMES.title,
  });
}

export function seasonQueryOptions(key: TitleKey, season: number) {
  return queryOptions({
    queryKey: queryKeys.season(key, season),
    queryFn: ({signal}) => fetchSeason(key, season, signal),
    ...QUERY_TIMES.season,
  });
}

export function personQueryOptions(key: PersonKey) {
  return queryOptions({
    queryKey: queryKeys.person(key),
    queryFn: ({signal}) => fetchPerson(key, signal),
    ...QUERY_TIMES.person,
  });
}

export function genresQueryOptions() {
  const snapshot = once(readReferenceSnapshot);
  return queryOptions({
    queryKey: queryKeys.genres(),
    queryFn: async ({signal}) => {
      const genres = await fetchGenres(signal);
      writeReferenceSnapshot({genres});
      return genres;
    },
    initialData: () => {
      const genres = snapshot()?.genres;
      return nonEmpty(genres) ? [...genres] : undefined;
    },
    initialDataUpdatedAt: () => snapshot()?.savedAt,
    ...QUERY_TIMES.genres,
  });
}

export function regionsQueryOptions() {
  const snapshot = once(readReferenceSnapshot);
  return queryOptions({
    queryKey: queryKeys.regions(),
    queryFn: async ({signal}) => {
      const regions = await fetchRegions(signal);
      writeReferenceSnapshot({regions});
      return regions;
    },
    initialData: () => {
      const regions = snapshot()?.regions;
      return nonEmpty(regions) ? [...regions] : undefined;
    },
    initialDataUpdatedAt: () => snapshot()?.savedAt,
    ...QUERY_TIMES.regions,
  });
}

export function providersQueryOptions(region: RegionCode) {
  return queryOptions({
    queryKey: queryKeys.providers(region),
    queryFn: ({signal}) => fetchProviders(region, signal),
    ...QUERY_TIMES.providers,
  });
}

export function availabilityQueryOptions(region: RegionCode, key: TitleKey) {
  return queryOptions({
    queryKey: queryKeys.availability(region, key),
    queryFn: () => loadAvailability(region, key),
    ...QUERY_TIMES.availability,
  });
}

export function findQueryOptions(imdbId: string) {
  return queryOptions({
    queryKey: queryKeys.find(imdbId),
    queryFn: ({signal}) => fetchFind(imdbId, signal),
    ...QUERY_TIMES.find,
  });
}

export function legacyMovieQueryOptions(v1Id: number) {
  return queryOptions({
    queryKey: queryKeys.legacyMovie(v1Id),
    queryFn: ({signal}) => fetchLegacyMovie(v1Id, signal),
    ...QUERY_TIMES.legacyMovie,
  });
}

export function geoQueryOptions() {
  return queryOptions({
    queryKey: queryKeys.geo(),
    queryFn: ({signal}) => fetchGeo(signal),
    ...QUERY_TIMES.geo,
  });
}
