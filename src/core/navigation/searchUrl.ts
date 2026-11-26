import type {OfferType} from '@/core/domain/providers';
import {OFFER_TYPES} from '@/core/domain/providers';
import type {DiscoverSort, SearchType, SearchUrlState} from '@/core/domain/search';
import {DEFAULT_SEARCH_URL_STATE, searchPath} from '@/core/domain/search';
import type {UrlCodec, UrlParams} from './urlState';

export type {SearchUrlState};

export type SearchUrlInput = {readonly [K in keyof SearchUrlState]?: unknown};

export const SEARCH_URL_KEYS = ['q', 'type', 'genres', 'providers', 'monetization', 'sort', 'year_from', 'year_to', 'rating_min', 'lang'] as const;

const MAX_QUERY_LENGTH = 100;
const MAX_GENRES = 5;
const MAX_PROVIDERS = 20;
const MAX_LIST_ID = 999999;
const CONTROL_CHARACTERS = /[\u0000-\u001f\u007f]/g;
const LIST_ID = /^\d{1,6}$/;
const YEAR = /^(19|20|21)\d{2}$/;
const RATING = /^(10|[0-9](\.5)?)$/;
const LANGUAGE = /^[a-z]{2}$/;

const SEARCH_TYPES: Readonly<Record<SearchType, true>> = {all: true, movie: true, tv: true, person: true};
const DISCOVER_SORTS: Readonly<Record<DiscoverSort, true>> = {popular: true, rating: true, release: true, title: true};

function isMember<T extends string>(members: Readonly<Record<T, true>>, value: unknown): value is T {
  return typeof value === 'string' && Object.hasOwn(members, value);
}

function isLoneSurrogate(character: string): boolean {
  const code = character.charCodeAt(0);
  return character.length === 1 && code >= 0xd800 && code <= 0xdfff;
}

function cleanQuery(value: unknown): string {
  if (typeof value !== 'string') return '';
  const characters = Array.from(value.replace(CONTROL_CHARACTERS, '')).filter((character) => !isLoneSurrogate(character));
  return characters.slice(0, MAX_QUERY_LENGTH).join('');
}

function cleanIds(value: unknown, max: number): number[] {
  if (!Array.isArray(value)) return [];
  const ids: number[] = [];
  for (const id of value) {
    if (ids.length === max) break;
    if (typeof id !== 'number' || !Number.isSafeInteger(id) || id < 1 || id > MAX_LIST_ID || ids.includes(id)) continue;
    ids.push(id);
  }
  return ids;
}

function cleanOffers(value: unknown): OfferType[] {
  if (!Array.isArray(value)) return [];
  const offers: OfferType[] = [];
  for (const offer of value) {
    if (OFFER_TYPES.includes(offer) && !offers.includes(offer)) offers.push(offer);
  }
  return offers;
}

function cleanYear(value: unknown): number | null {
  return typeof value === 'number' && Number.isInteger(value) && value >= 1900 && value <= 2199 ? value : null;
}

function cleanRating(value: unknown): number | null {
  return typeof value === 'number' && value > 0 && value <= 10 && Number.isInteger(value * 2) ? value : null;
}

function cleanLanguage(value: unknown): string | null {
  return typeof value === 'string' && LANGUAGE.test(value) ? value : null;
}

export function normalizeSearchUrlState(input: SearchUrlInput): SearchUrlState {
  const yearFrom = cleanYear(input.yearFrom);
  const yearTo = cleanYear(input.yearTo);
  const reversed = yearFrom !== null && yearTo !== null && yearFrom > yearTo;
  return {
    q: cleanQuery(input.q),
    type: isMember(SEARCH_TYPES, input.type) ? input.type : DEFAULT_SEARCH_URL_STATE.type,
    genres: cleanIds(input.genres, MAX_GENRES),
    providers: cleanIds(input.providers, MAX_PROVIDERS),
    monetization: cleanOffers(input.monetization),
    sort: isMember(DISCOVER_SORTS, input.sort) ? input.sort : DEFAULT_SEARCH_URL_STATE.sort,
    yearFrom: reversed ? null : yearFrom,
    yearTo: reversed ? null : yearTo,
    ratingMin: cleanRating(input.ratingMin),
    language: cleanLanguage(input.language),
  };
}

function firstValue(value: string | string[] | undefined): string {
  return (Array.isArray(value) ? value[0] : value) ?? '';
}

function listParts(value: string | string[] | undefined): string[] {
  const text = Array.isArray(value) ? value.join(',') : value ?? '';
  return text.split(',').map((part) => part.trim()).filter((part) => part.length > 0);
}

function matching(value: string, pattern: RegExp): number | null {
  return pattern.test(value) ? Number(value) : null;
}

function parseSearchUrl(params: UrlParams): SearchUrlState {
  return normalizeSearchUrlState({
    q: firstValue(params.q),
    type: firstValue(params.type),
    genres: listParts(params.genres).filter((part) => LIST_ID.test(part)).map(Number),
    providers: listParts(params.providers).filter((part) => LIST_ID.test(part)).map(Number),
    monetization: listParts(params.monetization),
    sort: firstValue(params.sort),
    yearFrom: matching(firstValue(params.year_from), YEAR),
    yearTo: matching(firstValue(params.year_to), YEAR),
    ratingMin: matching(firstValue(params.rating_min), RATING),
    language: firstValue(params.lang),
  });
}

function serializeSearchUrl(state: SearchUrlState): Record<string, string | undefined> {
  const path = searchPath(normalizeSearchUrlState(state));
  const start = path.indexOf('?');
  const present = new Map<string, string>();
  for (const pair of start === -1 ? [] : path.slice(start + 1).split('&')) {
    const separator = pair.indexOf('=');
    present.set(decodeURIComponent(pair.slice(0, separator)), decodeURIComponent(pair.slice(separator + 1)));
  }
  const serialized: Record<string, string | undefined> = {};
  for (const key of SEARCH_URL_KEYS) serialized[key] = present.get(key);
  return serialized;
}

export const searchUrlCodec: UrlCodec<SearchUrlState> = {
  keys: SEARCH_URL_KEYS,
  parse: parseSearchUrl,
  serialize: serializeSearchUrl,
};
