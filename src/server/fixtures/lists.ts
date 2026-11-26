import type {DiscoverResponse, HomeResponse, SearchResponse} from '@/core/domain/api';
import type {MediaType} from '@/core/domain/keys';
import type {PersonSummary} from '@/core/domain/person';
import type {RegionCode} from '@/core/domain/providers';
import type {Paged, SearchResult, SearchType} from '@/core/domain/search';
import type {TitleSummary} from '@/core/domain/title';
import discoverMovie from './v2/discover.movie.json';
import discoverTv from './v2/discover.tv.json';
import homeIN from './v2/home.IN.json';
import homeUS from './v2/home.US.json';
import peoplePopular from './v2/people.popular.json';
import search from './v2/search.json';

const HOME: Readonly<Record<string, HomeResponse>> = {
  IN: homeIN as unknown as HomeResponse,
  US: homeUS as unknown as HomeResponse,
};
const DISCOVER: Readonly<Record<MediaType, DiscoverResponse>> = {
  movie: discoverMovie as unknown as DiscoverResponse,
  tv: discoverTv as unknown as DiscoverResponse,
};
const SEARCH = search as unknown as SearchResponse;
const PEOPLE = peoplePopular as unknown as Paged<PersonSummary>;

export function fixtureHome(region: RegionCode): HomeResponse {
  const home = HOME[region] ?? HOME.US;
  return {...home, region};
}

export function fixtureDiscover(type: MediaType): DiscoverResponse {
  return DISCOVER[type];
}

export function fixtureDiscoverPage(type: MediaType): Paged<TitleSummary> {
  const {page, totalPages, totalResults, results} = DISCOVER[type];
  return {page, totalPages, totalResults, results};
}

export function fixturePopularPeople(): Paged<PersonSummary> {
  return PEOPLE;
}

function matchesType(result: SearchResult, type: SearchType): boolean {
  if (type === 'all') return true;
  if (result.kind === 'person') return type === 'person';
  return result.title.type === type;
}

function searchText(result: SearchResult): string {
  return result.kind === 'person' ? result.person.name : `${result.title.title} ${result.title.originalTitle}`;
}

export function fixtureSearch(q: string, type: SearchType, page: number): SearchResponse {
  const needle = q.toLowerCase();
  const results = SEARCH.results.filter((result) => matchesType(result, type) && searchText(result).toLowerCase().includes(needle));
  return {v: 2, q, type, page, totalPages: 1, totalResults: results.length, results: page === 1 ? results : []};
}
