import {normalizeSearchQuery} from '@/core/api/endpoints';
import type {MediaType, PersonKey, TitleKey} from '@/core/domain/keys';
import type {OfferType, RegionCode} from '@/core/domain/providers';
import type {DiscoverParams, DiscoverSort, SearchType} from '@/core/domain/search';

export interface CanonicalDiscover {
  type: MediaType;
  genres?: number[];
  providers?: number[];
  monetization?: OfferType[];
  region?: RegionCode;
  sort?: DiscoverSort;
  yearFrom?: number;
  yearTo?: number;
  ratingMin?: number;
  language?: string;
}

function sortedNumbers(values: readonly number[]): number[] {
  return [...new Set(values)].sort((a, b) => a - b);
}

export function canonicalDiscover(params: DiscoverParams): CanonicalDiscover {
  const canonical: CanonicalDiscover = {type: params.type};
  if (params.genres.length) canonical.genres = sortedNumbers(params.genres);
  if (params.providers.length) canonical.providers = sortedNumbers(params.providers);
  if (params.monetization.length) canonical.monetization = [...new Set(params.monetization)].sort();
  if ((params.providers.length || params.monetization.length) && params.region !== null) canonical.region = params.region;
  if (params.sort !== 'popular') canonical.sort = params.sort;
  if (params.yearFrom !== null) canonical.yearFrom = params.yearFrom;
  if (params.yearTo !== null) canonical.yearTo = params.yearTo;
  if (params.ratingMin !== null) canonical.ratingMin = params.ratingMin;
  if (params.language !== null) canonical.language = params.language;
  return canonical;
}

export const queryKeys = {
  home: (region: RegionCode) => ['v2', 'home', region] as const,
  discover: (params: DiscoverParams) => ['v2', 'discover', canonicalDiscover(params)] as const,
  search: (q: string, type: SearchType) => ['v2', 'search', type, normalizeSearchQuery(q)] as const,
  title: (key: TitleKey, region: RegionCode) => ['v2', 'title', key, region] as const,
  season: (key: TitleKey, season: number) => ['v2', 'season', key, season] as const,
  person: (key: PersonKey) => ['v2', 'person', key] as const,
  genres: () => ['v2', 'genres'] as const,
  regions: () => ['v2', 'regions'] as const,
  providers: (region: RegionCode) => ['v2', 'providers', region] as const,
  availability: (region: RegionCode, key: TitleKey) => ['v2', 'availability', region, key] as const,
  find: (imdbId: string) => ['v2', 'find', imdbId] as const,
  legacyMovie: (v1Id: number) => ['v2', 'legacy-movie', v1Id] as const,
  geo: () => ['v2', 'geo'] as const,
};
