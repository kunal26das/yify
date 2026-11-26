import type {DiscoverSort, SearchUrlState} from './search';
import {DEFAULT_SEARCH_URL_STATE} from './search';

export type LegacyParams = Record<string, string | string[] | undefined>;

export const LEGACY_MOVIE_GENRES: ReadonlyMap<string, number> = new Map([
  ['action', 28],
  ['adventure', 12],
  ['animation', 16],
  ['comedy', 35],
  ['crime', 80],
  ['documentary', 99],
  ['drama', 18],
  ['fantasy', 14],
  ['horror', 27],
  ['mystery', 9648],
  ['romance', 10749],
  ['sci-fi', 878],
  ['thriller', 53],
  ['war', 10752],
  ['western', 37],
]);

export const LEGACY_MOVIE_SORTS: ReadonlyMap<string, DiscoverSort> = new Map<string, DiscoverSort>([
  ['date_added', 'release'],
  ['year', 'release'],
  ['title', 'title'],
  ['rating', 'rating'],
  ['like_count', 'popular'],
  ['download_count', 'popular'],
  ['seeds', 'popular'],
  ['peers', 'popular'],
]);

const MAX_QUERY_LENGTH = 100;
const CONTROL_CHARACTERS = /[\u0000-\u001f\u007f]/g;

function first(value: string | string[] | undefined): string {
  return (Array.isArray(value) ? value[0] : value)?.trim() ?? '';
}

function legacyQuery(value: string): string {
  return Array.from(value.replace(CONTROL_CHARACTERS, '').trim()).slice(0, MAX_QUERY_LENGTH).join('').trim();
}

function legacyRating(value: string): number | null {
  if (!/^\d{1,2}(?:\.\d+)?$/.test(value)) return null;
  const rating = Math.floor(Number(value) * 2) / 2;
  return rating > 0 && rating <= 10 ? rating : null;
}

export function legacyMoviesToSearch(params: LegacyParams): SearchUrlState {
  const genre = LEGACY_MOVIE_GENRES.get(first(params.genre).toLowerCase());
  return {
    ...DEFAULT_SEARCH_URL_STATE,
    q: legacyQuery(first(params.query)),
    type: 'movie',
    genres: genre === undefined ? [] : [genre],
    sort: LEGACY_MOVIE_SORTS.get(first(params.sort_by).toLowerCase()) ?? DEFAULT_SEARCH_URL_STATE.sort,
    ratingMin: legacyRating(first(params.minimum_rating)),
  };
}

export function legacyShowsToSearch(): SearchUrlState {
  return {...DEFAULT_SEARCH_URL_STATE, type: 'tv'};
}

export function imdbFromShowDigits(digits: string): string | null {
  const match = /^(?:tt)?(\d{1,10})$/i.exec(digits.trim());
  if (!match || Number(match[1]) === 0) return null;
  return `tt${match[1].padStart(7, '0')}`;
}
