import type {
  YtsApiResponse,
  YtsListMoviesResponse,
  YtsMovieDetailsResponse,
  YtsMovieParentalGuidesResponse,
  YtsMovieSuggestionsResponse,
} from '../models';
import {YtsEndpoint} from './YtsEndpoint';
import type {Diagnostics} from '@/domain';
import {NOOP_DIAGNOSTICS} from '../services/NoopDiagnostics';
import {InvalidResponseError, requestJson} from './JsonRequest';

export const DEFAULT_BASE_URL = 'https://movies-api.accel.li/api/v2';

export function secureBaseUrl(value: string | null | undefined): string {
  return typeof value === 'string' && value.startsWith('https://') ? value : DEFAULT_BASE_URL;
}

const REQUEST_TIMEOUT_MS = 15000;

const LIST_TTL_MS = 60_000;
const DETAILS_TTL_MS = 10 * 60_000;
const MAX_CACHE_ENTRIES = 120;

interface CacheEntry {
  expiresAt: number;
  value: Promise<unknown>;
}

const responseCache = new Map<string, CacheEntry>();

function getCachedResponse<T>(key: string): Promise<T> | null {
  const entry = responseCache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    responseCache.delete(key);
    return null;
  }
  return entry.value as Promise<T>;
}

function setCachedResponse(key: string, value: Promise<unknown>, ttlMs: number): void {
  if (responseCache.size >= MAX_CACHE_ENTRIES) {
    const oldest = responseCache.keys().next().value;
    if (oldest !== undefined) responseCache.delete(oldest);
  }
  responseCache.set(key, {expiresAt: Date.now() + ttlMs, value});
}

export function clearApiResponseCache(): void {
  responseCache.clear();
}

export interface ListMoviesApiParams {
  page: number;
  limit?: number;
  query?: string;
  quality?: string;
  minimum_rating?: number;
  genre?: string;
  sort_by?: string;
  order_by?: 'asc' | 'desc';
  with_rt_ratings?: boolean;
}

export interface MovieDetailsApiParams {
  movie_id?: number;
  imdb_id?: string;
  with_images?: boolean;
  with_cast?: boolean;
}

export interface ListMoviesApi {
  listMovies(params: ListMoviesApiParams): Promise<YtsListMoviesResponse>;
}

export interface MovieDetailsApi {
  getMovieDetails(params: MovieDetailsApiParams): Promise<YtsMovieDetailsResponse>;
}

export interface MovieSuggestionsApi {
  getMovieSuggestions(movieId: number): Promise<YtsMovieSuggestionsResponse>;
}

export interface MovieParentalGuidesApi {
  getMovieParentalGuides(movieId: number): Promise<YtsMovieParentalGuidesResponse>;
}

export interface YtsApi
    extends ListMoviesApi,
        MovieDetailsApi,
        MovieSuggestionsApi,
        MovieParentalGuidesApi {
}

function record(value: unknown): value is Record<string, unknown> {
  return value != null && typeof value === 'object' && !Array.isArray(value);
}

export function parseYtsResponse<T extends YtsApiResponse<unknown>>(body: unknown, endpoint: YtsEndpoint): T {
  if (!record(body) || !['ok', 'error'].includes(String(body.status))) throw new InvalidResponseError();
  if (body.status === 'error') throw new InvalidResponseError('upstream_rejected');
  if (!record(body.data)) throw new InvalidResponseError();
  const data = body.data;
  if (endpoint === YtsEndpoint.ListMovies && (!Number.isSafeInteger(data.movie_count) || Number(data.movie_count) < 0
      || !Number.isSafeInteger(data.page_number) || Number(data.page_number) < 1
      || !Number.isSafeInteger(data.limit) || Number(data.limit) < 1)) throw new InvalidResponseError();
  if (endpoint === YtsEndpoint.MovieDetails && !record(data.movie)) throw new InvalidResponseError();
  const movies = endpoint === YtsEndpoint.MovieDetails ? [data.movie] : data.movies;
  if (movies !== undefined && (!Array.isArray(movies) || movies.some(movie => !record(movie)
      || !Number.isSafeInteger(movie.id) || Number(movie.id) < 1 || typeof movie.title !== 'string'
      || (movie.genres != null && !Array.isArray(movie.genres))
      || (movie.cast != null && !Array.isArray(movie.cast))
      || (movie.torrents != null && !Array.isArray(movie.torrents))))) throw new InvalidResponseError();
  if (data.parental_guides !== undefined && (!Array.isArray(data.parental_guides)
      || data.parental_guides.some(guide => !record(guide) || typeof guide.type !== 'string'
          || typeof guide.parental_guide_text !== 'string'))) throw new InvalidResponseError();
  return body as unknown as T;
}

function fetchWithTimeout<T extends YtsApiResponse<unknown>>(
    url: string, diagnostics: Diagnostics, operation: string, fetcher: typeof fetch, endpoint: YtsEndpoint,
): Promise<T> {
  return requestJson(url, {
    diagnostics, operation, provider: 'yts', timeoutMs: REQUEST_TIMEOUT_MS, fetcher,
    parse: body => parseYtsResponse<T>(body, endpoint),
  });
}

export class YtsApiDataSource implements YtsApi {
  constructor(private readonly resolveBaseUrl: () => string = () => DEFAULT_BASE_URL,
              private readonly diagnostics: Diagnostics = NOOP_DIAGNOSTICS,
              private readonly options: {fetch?: typeof fetch; cache?: boolean} = {}) {
  }

  async listMovies(params: ListMoviesApiParams): Promise<YtsListMoviesResponse> {
    const searchParams = new URLSearchParams({
      page: String(params.page),
      limit: String(params.limit ?? 20),
    });
    if (params.query?.trim()) {
      searchParams.set('query_term', params.query.trim());
    }
    if (params.quality) {
      searchParams.set('quality', params.quality);
    }
    if (params.minimum_rating != null && params.minimum_rating > 0) {
      searchParams.set('minimum_rating', String(params.minimum_rating));
    }
    if (params.genre?.trim()) {
      searchParams.set('genre', params.genre.trim());
    }
    if (params.sort_by) {
      searchParams.set('sort_by', params.sort_by);
    }
    if (params.order_by) {
      searchParams.set('order_by', params.order_by);
    }
    if (params.with_rt_ratings) {
      searchParams.set('with_rt_ratings', 'true');
    }
    return this.request<YtsListMoviesResponse>(YtsEndpoint.ListMovies, searchParams, LIST_TTL_MS);
  }

  async getMovieDetails(params: MovieDetailsApiParams): Promise<YtsMovieDetailsResponse> {
    const searchParams = new URLSearchParams();
    if (params.movie_id != null) {
      searchParams.set('movie_id', String(params.movie_id));
    }
    if (params.imdb_id?.trim()) {
      searchParams.set('imdb_id', params.imdb_id.trim());
    }
    if (params.with_images) {
      searchParams.set('with_images', 'true');
    }
    if (params.with_cast) {
      searchParams.set('with_cast', 'true');
    }
    return this.request<YtsMovieDetailsResponse>(YtsEndpoint.MovieDetails, searchParams, DETAILS_TTL_MS);
  }

  async getMovieSuggestions(movieId: number): Promise<YtsMovieSuggestionsResponse> {
    const searchParams = new URLSearchParams({movie_id: String(movieId)});
    return this.request<YtsMovieSuggestionsResponse>(
        YtsEndpoint.MovieSuggestions,
        searchParams,
        DETAILS_TTL_MS
    );
  }

  async getMovieParentalGuides(movieId: number): Promise<YtsMovieParentalGuidesResponse> {
    const searchParams = new URLSearchParams({movie_id: String(movieId)});
    return this.request<YtsMovieParentalGuidesResponse>(
        YtsEndpoint.MovieParentalGuides,
        searchParams,
        DETAILS_TTL_MS
    );
  }

  private async request<T extends YtsApiResponse<unknown>>(
      endpoint: YtsEndpoint,
      searchParams: URLSearchParams,
      ttlMs = 0
  ): Promise<T> {
    if (this.options.cache === false) ttlMs = 0;
    const query = searchParams.toString();
    const suffix = query ? `?${query}` : '';
    const baseUrl = this.resolveBaseUrl().replace(/\/+$/, '');
    const url = `${baseUrl}/${endpoint}${suffix}`;

    if (ttlMs > 0) {
      const cached = getCachedResponse<T>(url);
      if (cached) {
        this.diagnostics.event('api.yts.cache', {provider: 'yts', cache: 'hit'});
        return cached;
      }
    }

    const operation = `api.yts.${endpoint.replace('.json', '')}`;
    const promise = fetchWithTimeout<T>(url, this.diagnostics, operation, this.options.fetch ?? fetch, endpoint).catch((error) => {
      if (ttlMs > 0) responseCache.delete(url);
      throw error;
    });

    if (ttlMs > 0) setCachedResponse(url, promise, ttlMs);
    return promise;
  }
}
