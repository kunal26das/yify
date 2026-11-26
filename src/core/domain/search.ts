import type {MediaType} from './keys';
import type {OfferType, RegionCode} from './providers';
import type {PersonSummary} from './person';
import type {TitleSummary} from './title';

export type SearchType = 'all' | 'movie' | 'tv' | 'person';

export type SearchResult =
  | {kind: 'title'; title: TitleSummary}
  | {kind: 'person'; person: PersonSummary};

export type DiscoverSort = 'popular' | 'rating' | 'release' | 'title';

export interface DiscoverParams {
  type: MediaType;
  genres: number[];
  providers: number[];
  monetization: OfferType[];
  region: RegionCode | null;
  sort: DiscoverSort;
  yearFrom: number | null;
  yearTo: number | null;
  ratingMin: number | null;
  language: string | null;
}

export interface Paged<T> {
  page: number;
  totalPages: number;
  totalResults: number;
  results: T[];
}

export interface SearchUrlState {
  q: string;
  type: SearchType;
  genres: number[];
  providers: number[];
  monetization: OfferType[];
  sort: DiscoverSort;
  yearFrom: number | null;
  yearTo: number | null;
  ratingMin: number | null;
  language: string | null;
}

export const DEFAULT_SEARCH_URL_STATE: SearchUrlState = {
  q: '',
  type: 'all',
  genres: [],
  providers: [],
  monetization: [],
  sort: 'popular',
  yearFrom: null,
  yearTo: null,
  ratingMin: null,
  language: null,
};

function queryValue(value: string): string {
  return encodeURIComponent(value).replace(/%2C/gi, ',');
}

export function searchPath(state: Partial<SearchUrlState>): string {
  const full: SearchUrlState = {...DEFAULT_SEARCH_URL_STATE, ...state};
  const params: [string, string][] = [];
  if (full.q) params.push(['q', full.q]);
  if (full.type !== DEFAULT_SEARCH_URL_STATE.type) params.push(['type', full.type]);
  if (full.genres.length) params.push(['genres', full.genres.join(',')]);
  if (full.providers.length) params.push(['providers', full.providers.join(',')]);
  if (full.monetization.length) params.push(['monetization', full.monetization.join(',')]);
  if (full.sort !== DEFAULT_SEARCH_URL_STATE.sort) params.push(['sort', full.sort]);
  if (full.yearFrom !== null) params.push(['year_from', String(full.yearFrom)]);
  if (full.yearTo !== null) params.push(['year_to', String(full.yearTo)]);
  if (full.ratingMin !== null) params.push(['rating_min', String(full.ratingMin)]);
  if (full.language !== null) params.push(['lang', full.language]);
  const query = params.map(([key, value]) => `${key}=${queryValue(value)}`).join('&');
  return query ? `/search?${query}` : '/search';
}
