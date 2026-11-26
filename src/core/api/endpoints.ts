import type {
  AvailabilityResponse,
  DiscoverResponse,
  FindResponse,
  GeoResponse,
  HealthResponse,
  HomeResponse,
  LegacyMovieResponse,
  ResolveRequest,
  ResolveResponse,
  SearchResponse,
} from '@/core/domain/api';
import type {PersonKey, TitleKey} from '@/core/domain/keys';
import {parseTitleKey} from '@/core/domain/keys';
import type {PersonDetails} from '@/core/domain/person';
import type {CatalogProvider, Region, RegionAvailability, RegionCode} from '@/core/domain/providers';
import type {DiscoverParams, SearchType} from '@/core/domain/search';
import type {Genre, SeasonDetails, TitleDetails} from '@/core/domain/title';
import {createBatcher} from './batch';
import type {ApiQuery} from './client';
import {apiGet, apiPost} from './client';
import {
  decodeAvailabilityResponse,
  decodeDiscoverResponse,
  decodeFindResponse,
  decodeGenresResponse,
  decodeGeoResponse,
  decodeHealthResponse,
  decodeHomeResponse,
  decodeLegacyMovieResponse,
  decodePersonResponse,
  decodeProvidersResponse,
  decodeRegionsResponse,
  decodeResolveResponse,
  decodeSearchResponse,
  decodeSeasonResponse,
  decodeTitleResponse,
} from './decode';
import {ApiError} from './errors';

export const AVAILABILITY_BATCH_SIZE = 40;
export const AVAILABILITY_WINDOW_MS = 16;

const PERSON_KEY = /^person:([1-9]\d{0,9})$/;

function titleParts(key: TitleKey): {type: 'movie' | 'tv'; id: number} {
  const parsed = parseTitleKey(key);
  if (parsed === null) throw new RangeError(`Invalid title key: ${key}`);
  return parsed;
}

function personId(key: PersonKey): number {
  const match = PERSON_KEY.exec(key);
  if (match === null) throw new RangeError(`Invalid person key: ${key}`);
  return Number(match[1]);
}

function sortedNumbers(values: readonly number[]): number[] {
  return [...new Set(values)].sort((a, b) => a - b);
}

function list(values: readonly (string | number)[]): string | undefined {
  return values.length ? values.join(',') : undefined;
}

export function normalizeSearchQuery(q: string): string {
  return q.trim().replace(/\s+/g, ' ').toLowerCase();
}

export function discoverQuery(params: DiscoverParams, page: number): ApiQuery {
  const filtered = params.providers.length > 0 || params.monetization.length > 0;
  return {
    type: params.type,
    page,
    genres: list(sortedNumbers(params.genres)),
    providers: list(sortedNumbers(params.providers)),
    monetization: list([...new Set(params.monetization)].sort()),
    region: filtered && params.region !== null ? params.region : undefined,
    sort: params.sort,
    year_from: params.yearFrom ?? undefined,
    year_to: params.yearTo ?? undefined,
    rating_min: params.ratingMin ?? undefined,
    lang: params.language ?? undefined,
  };
}

export function fetchHome(region: RegionCode, signal?: AbortSignal): Promise<HomeResponse> {
  return apiGet('/home', {region}, decodeHomeResponse, {signal});
}

export function fetchDiscover(params: DiscoverParams, page: number, signal?: AbortSignal): Promise<DiscoverResponse> {
  return apiGet('/discover', discoverQuery(params, page), decodeDiscoverResponse, {signal});
}

export function fetchSearch(q: string, type: SearchType, page: number, signal?: AbortSignal): Promise<SearchResponse> {
  return apiGet('/search', {page, q: normalizeSearchQuery(q), type}, decodeSearchResponse, {signal});
}

export async function fetchTitle(key: TitleKey, region: RegionCode, signal?: AbortSignal): Promise<TitleDetails> {
  const {type, id} = titleParts(key);
  return (await apiGet(`/title/${type}/${id}`, {region}, decodeTitleResponse, {signal})).title;
}

export async function fetchSeason(key: TitleKey, season: number, signal?: AbortSignal): Promise<SeasonDetails> {
  const {type, id} = titleParts(key);
  if (type !== 'tv') throw new RangeError(`Seasons belong to TV titles: ${key}`);
  return (await apiGet(`/title/tv/${id}/season/${season}`, {}, decodeSeasonResponse, {signal})).season;
}

export async function fetchPerson(key: PersonKey, signal?: AbortSignal): Promise<PersonDetails> {
  return (await apiGet(`/person/${personId(key)}`, {}, decodePersonResponse, {signal})).person;
}

export async function fetchGenres(signal?: AbortSignal): Promise<Genre[]> {
  return (await apiGet('/genres', {}, decodeGenresResponse, {signal})).genres;
}

export async function fetchRegions(signal?: AbortSignal): Promise<Region[]> {
  return (await apiGet('/regions', {}, decodeRegionsResponse, {signal})).regions;
}

export async function fetchProviders(region: RegionCode, signal?: AbortSignal): Promise<CatalogProvider[]> {
  return (await apiGet('/providers', {region}, decodeProvidersResponse, {signal})).providers;
}

export function fetchAvailability(region: RegionCode, keys: readonly TitleKey[], signal?: AbortSignal): Promise<AvailabilityResponse> {
  const sorted = [...new Set(keys)].sort();
  return apiPost('/availability', {keys: sorted, region}, decodeAvailabilityResponse, {signal});
}

export function fetchFind(imdbId: string, signal?: AbortSignal): Promise<FindResponse> {
  return apiGet(`/find/${encodeURIComponent(imdbId)}`, {}, decodeFindResponse, {signal});
}

export function fetchLegacyMovie(v1Id: number, signal?: AbortSignal): Promise<LegacyMovieResponse> {
  return apiGet(`/legacy/movie/${v1Id}`, {}, decodeLegacyMovieResponse, {signal});
}

export function postResolve(request: ResolveRequest, signal?: AbortSignal): Promise<ResolveResponse> {
  const body: ResolveRequest = {
    imdb: [...new Set(request.imdb)].sort(),
    v1: [...request.v1].sort((a, b) => a.id - b.id),
  };
  return apiPost('/resolve', body, decodeResolveResponse, {signal});
}

export function fetchGeo(signal?: AbortSignal): Promise<GeoResponse> {
  return apiGet('/geo', {}, decodeGeoResponse, {signal});
}

export function fetchHealth(signal?: AbortSignal): Promise<HealthResponse> {
  return apiGet('/health', {}, decodeHealthResponse, {signal});
}

const availabilityBatchers = new Map<RegionCode, (key: TitleKey) => Promise<RegionAvailability | null>>();

function availabilityBatcher(region: RegionCode): (key: TitleKey) => Promise<RegionAvailability | null> {
  let batcher = availabilityBatchers.get(region);
  if (batcher === undefined) {
    batcher = createBatcher<TitleKey, RegionAvailability | null>({
      maxBatch: AVAILABILITY_BATCH_SIZE,
      windowMs: AVAILABILITY_WINDOW_MS,
      load: async (keys) => {
        const response = await fetchAvailability(region, keys);
        const result = new Map<TitleKey, RegionAvailability | null>();
        for (const key of keys) {
          const value = response.items[key];
          if (value !== undefined && !response.failed.includes(key)) result.set(key, value);
        }
        return result;
      },
      missing: () => new ApiError(503, 'upstream_unavailable', null),
    });
    availabilityBatchers.set(region, batcher);
  }
  return batcher;
}

export function loadAvailability(region: RegionCode, key: TitleKey): Promise<RegionAvailability | null> {
  return availabilityBatcher(region)(key);
}
