import type {ApiErrorCode, AvailabilityRequest, ResolveRequest, V1Candidate} from '@/core/domain/api';
import type {MediaType, TitleKey} from '@/core/domain/keys';
import {MAX_TMDB_ID, parseTitleKey} from '@/core/domain/keys';
import type {OfferType, RegionCode} from '@/core/domain/providers';
import {OFFER_TYPES} from '@/core/domain/providers';
import type {DiscoverParams, DiscoverSort, SearchType} from '@/core/domain/search';

export type RequestErrorStatus = 400 | 404 | 405 | 413;

export class RequestError extends Error {
  readonly status: RequestErrorStatus;
  readonly code: ApiErrorCode;

  constructor(status: RequestErrorStatus, code: ApiErrorCode, message: string) {
    super(message);
    this.name = 'RequestError';
    this.status = status;
    this.code = code;
  }
}

export function invalidRequest(message: string): RequestError {
  return new RequestError(400, 'invalid_request', message);
}

export function notFound(message: string = 'The resource was not found.'): RequestError {
  return new RequestError(404, 'not_found', message);
}

export function methodNotAllowed(message: string = 'The method is not allowed.'): RequestError {
  return new RequestError(405, 'method_not_allowed', message);
}

export function payloadTooLarge(message: string = 'The request body is too large.'): RequestError {
  return new RequestError(413, 'payload_too_large', message);
}

export const MAX_BODY_BYTES = 16_384;
export const MAX_PAGE = 500;
export const MAX_SEASON = 500;
export const MAX_AVAILABILITY_KEYS = 40;
export const MAX_RESOLVE_IDS = 20;
export const IMAGE_SIZES = ['w92', 'w154', 'w185', 'w300', 'w342', 'w500', 'w780', 'w1280', 'h632'] as const;
export type ImageSizeParam = (typeof IMAGE_SIZES)[number];

const REGION = /^[A-Z]{2}$/;
const ID = /^[1-9]\d{0,9}$/;
const SEASON = /^(0|[1-9]\d{0,2})$/;
const PAGE = /^[1-9]\d{0,2}$/;
const CONTROL = /[\u0000-\u001f\u007f]/;
const GENRES = /^\d{1,6}(,\d{1,6}){0,4}$/;
const PROVIDERS = /^\d{1,6}(,\d{1,6}){0,19}$/;
const YEAR = /^(19|20|21)\d{2}$/;
const RATING = /^(10|[0-9](\.5)?)$/;
const LANGUAGE = /^[a-z]{2}$/;
const IMDB_ID = /^tt\d{7,10}$/;
const IMAGE_FILE = /^[A-Za-z0-9_-]{6,80}\.(jpg|jpeg|png)$/;
const SORTS: readonly DiscoverSort[] = ['popular', 'rating', 'release', 'title'];
const SEARCH_TYPES: readonly SearchType[] = ['all', 'movie', 'tv', 'person'];

export function queryParams(url: URL, allowed: readonly string[]): Record<string, string> {
  const params: Record<string, string> = {};
  for (const key of new Set(url.searchParams.keys())) {
    if (!allowed.includes(key)) throw invalidRequest(`Unknown parameter: ${key.slice(0, 40)}`);
    const values = url.searchParams.getAll(key);
    if (values.length > 1) throw invalidRequest(`Duplicated parameter: ${key}`);
    params[key] = values[0];
  }
  return params;
}

export function regionParam(value: string | undefined): RegionCode {
  if (value === undefined || !REGION.test(value)) throw invalidRequest('region must be two upper-case letters.');
  return value;
}

export function optionalRegionParam(value: string | undefined): RegionCode | null {
  return value === undefined ? null : regionParam(value);
}

export function mediaTypeParam(value: string | undefined): MediaType {
  if (value === 'movie' || value === 'tv') return value;
  throw invalidRequest('type must be movie or tv.');
}

export function idParam(value: string | undefined): number {
  if (value === undefined || !ID.test(value) || Number(value) > MAX_TMDB_ID) throw invalidRequest('id is not a valid TMDB id.');
  return Number(value);
}

export function seasonParam(value: string | undefined): number {
  if (value === undefined || !SEASON.test(value) || Number(value) > MAX_SEASON) throw invalidRequest('season is out of range.');
  return Number(value);
}

export function pageParam(value: string | undefined): number {
  if (value === undefined) return 1;
  if (!PAGE.test(value) || Number(value) > MAX_PAGE) throw invalidRequest('page is out of range.');
  return Number(value);
}

export function searchQueryParam(value: string | undefined): string {
  const query = (value ?? '').trim().replace(/\s+/g, ' ');
  if (query.length < 1 || query.length > 100 || CONTROL.test(value ?? '')) throw invalidRequest('q must have 1 to 100 characters.');
  return query;
}

export function searchTypeParam(value: string | undefined): SearchType {
  if (value === undefined) return 'all';
  const type = SEARCH_TYPES.find((item) => item === value);
  if (type === undefined) throw invalidRequest('type must be all, movie, tv or person.');
  return type;
}

function idList(value: string | undefined, pattern: RegExp, name: string): number[] {
  if (value === undefined) return [];
  if (!pattern.test(value)) throw invalidRequest(`${name} is not a valid id list.`);
  const ids = value.split(',').map(Number);
  if (ids.some((id) => id < 1) || new Set(ids).size !== ids.length) throw invalidRequest(`${name} must hold distinct positive ids.`);
  return ids;
}

export function genresParam(value: string | undefined): number[] {
  return idList(value, GENRES, 'genres');
}

export function providersParam(value: string | undefined): number[] {
  return idList(value, PROVIDERS, 'providers');
}

export function monetizationParam(value: string | undefined): OfferType[] {
  if (value === undefined) return [];
  const items = value.split(',');
  const offers: OfferType[] = [];
  for (const item of items) {
    const offer = OFFER_TYPES.find((type) => type === item);
    if (offer === undefined || offers.includes(offer)) throw invalidRequest('monetization must list distinct offer types.');
    offers.push(offer);
  }
  return offers;
}

export function sortParam(value: string | undefined): DiscoverSort {
  if (value === undefined) return 'popular';
  const sort = SORTS.find((item) => item === value);
  if (sort === undefined) throw invalidRequest('sort must be popular, rating, release or title.');
  return sort;
}

export function yearParam(value: string | undefined, name: string): number | null {
  if (value === undefined) return null;
  if (!YEAR.test(value)) throw invalidRequest(`${name} must be a four-digit year.`);
  return Number(value);
}

export function ratingParam(value: string | undefined): number | null {
  if (value === undefined) return null;
  if (!RATING.test(value)) throw invalidRequest('rating_min must be 0 to 10 in half steps.');
  return Number(value);
}

export function languageParam(value: string | undefined): string | null {
  if (value === undefined) return null;
  if (!LANGUAGE.test(value)) throw invalidRequest('lang must be two lower-case letters.');
  return value;
}

export function imdbIdParam(value: string | undefined): string {
  if (value === undefined || !IMDB_ID.test(value)) throw invalidRequest('imdbId must look like tt0133093.');
  return value;
}

export function v1IdParam(value: string | undefined): number {
  if (value === undefined || !ID.test(value) || Number(value) > MAX_TMDB_ID) throw invalidRequest('v1Id is not a valid id.');
  return Number(value);
}

export function imageSizeParam(value: string | undefined): ImageSizeParam {
  const size = IMAGE_SIZES.find((item) => item === value);
  if (size === undefined) throw invalidRequest('size is not a supported image size.');
  return size;
}

export function imageFileParam(value: string | undefined): string {
  if (value === undefined || !IMAGE_FILE.test(value)) throw invalidRequest('file is not a valid image file.');
  return value;
}

export const DISCOVER_PARAMS = ['type', 'page', 'genres', 'providers', 'monetization', 'region', 'sort', 'year_from', 'year_to', 'rating_min', 'lang'] as const;

export function discoverParams(url: URL): {params: DiscoverParams; page: number} {
  const query = queryParams(url, DISCOVER_PARAMS);
  const providers = providersParam(query.providers);
  const monetization = monetizationParam(query.monetization);
  const yearFrom = yearParam(query.year_from, 'year_from');
  const yearTo = yearParam(query.year_to, 'year_to');
  if (yearFrom !== null && yearTo !== null && yearFrom > yearTo) throw invalidRequest('year_from must not be after year_to.');
  const region = optionalRegionParam(query.region);
  if ((providers.length > 0 || monetization.length > 0) && region === null) {
    throw invalidRequest('region is required with providers or monetization.');
  }
  return {
    page: pageParam(query.page),
    params: {
      type: mediaTypeParam(query.type),
      genres: genresParam(query.genres),
      providers,
      monetization,
      region,
      sort: sortParam(query.sort),
      yearFrom,
      yearTo,
      ratingMin: ratingParam(query.rating_min),
      language: languageParam(query.lang),
    },
  };
}

export async function readJsonBody(request: Request, maxBytes: number = MAX_BODY_BYTES): Promise<unknown> {
  const type = request.headers.get('content-type') ?? '';
  if (!/^application\/json(\s*;|$)/i.test(type.trim())) throw invalidRequest('Content-Type must be application/json.');
  const declared = Number(request.headers.get('content-length') ?? '0');
  if (Number.isFinite(declared) && declared > maxBytes) throw payloadTooLarge();
  const text = await request.text();
  if (new TextEncoder().encode(text).length > maxBytes) throw payloadTooLarge();
  try {
    return JSON.parse(text);
  } catch {
    throw invalidRequest('The body is not valid JSON.');
  }
}

function record(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

function onlyKeys(data: Record<string, unknown>, keys: readonly string[]): void {
  for (const key of Object.keys(data)) {
    if (!keys.includes(key)) throw invalidRequest(`Unknown field: ${key.slice(0, 40)}`);
  }
}

export function availabilityRequest(body: unknown): AvailabilityRequest {
  const data = record(body);
  if (data === null || !Array.isArray(data.keys)) throw invalidRequest('The body must hold region and keys.');
  onlyKeys(data, ['region', 'keys']);
  const region = regionParam(typeof data.region === 'string' ? data.region : undefined);
  if (data.keys.length > MAX_AVAILABILITY_KEYS) throw payloadTooLarge(`At most ${MAX_AVAILABILITY_KEYS} keys are allowed.`);
  const keys: TitleKey[] = [];
  for (const value of data.keys) {
    const parsed = typeof value === 'string' ? parseTitleKey(value) : null;
    if (parsed === null || keys.includes(parsed.key)) throw invalidRequest('keys must be distinct title keys.');
    keys.push(parsed.key);
  }
  if (keys.length === 0) throw invalidRequest('keys must not be empty.');
  return {region, keys};
}

function v1Candidate(value: unknown): V1Candidate {
  const data = record(value);
  if (data === null || typeof data.id !== 'number' || !Number.isSafeInteger(data.id) || data.id < 1 || data.id > MAX_TMDB_ID) {
    throw invalidRequest('v1 entries need a positive integer id.');
  }
  onlyKeys(data, ['id', 'title', 'year']);
  const title = data.title ?? null;
  const year = data.year ?? null;
  if (title !== null && (typeof title !== 'string' || title.length > 300)) throw invalidRequest('v1 titles must be strings.');
  if (year !== null && (typeof year !== 'number' || !Number.isInteger(year) || year < 1800 || year > 2200)) {
    throw invalidRequest('v1 years must be integers.');
  }
  return {id: data.id, title, year};
}

export function resolveRequest(body: unknown): ResolveRequest {
  const data = record(body);
  if (data === null) throw invalidRequest('The body must hold imdb and v1.');
  onlyKeys(data, ['imdb', 'v1']);
  const imdbValues = data.imdb ?? [];
  const v1Values = data.v1 ?? [];
  if (!Array.isArray(imdbValues) || !Array.isArray(v1Values)) throw invalidRequest('imdb and v1 must be arrays.');
  if (imdbValues.length + v1Values.length > MAX_RESOLVE_IDS) throw payloadTooLarge(`At most ${MAX_RESOLVE_IDS} ids are allowed.`);
  const imdb: string[] = [];
  for (const value of imdbValues) {
    if (typeof value !== 'string' || !IMDB_ID.test(value) || imdb.includes(value)) throw invalidRequest('imdb must hold distinct IMDb ids.');
    imdb.push(value);
  }
  const v1 = v1Values.map(v1Candidate);
  if (new Set(v1.map((candidate) => candidate.id)).size !== v1.length) throw invalidRequest('v1 ids must be distinct.');
  if (imdb.length + v1.length === 0) throw invalidRequest('The body must name at least one id.');
  return {imdb, v1};
}
