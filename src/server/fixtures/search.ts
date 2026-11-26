import type {SearchResponse} from '@/core/domain/api';
import type {SearchResult, SearchType} from '@/core/domain/search';
import search from './v2/search.json';

const SEARCH = search as unknown as SearchResponse;

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
