import type {
  YtsApiResponse,
  YtsListMoviesResponse,
  YtsMovieDetailsResponse,
  YtsMovieParentalGuidesResponse,
  YtsMovieSuggestionsResponse,
} from '../models';
import {YtsEndpoint} from './YtsEndpoint';

export const DEFAULT_BASE_URL = 'https://movies-api.accel.li/api/v2';

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

async function fetchWithTimeout<T extends { status: string; status_message?: string }>(
    url: string
): Promise<T> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(url, {signal: controller.signal});
    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }
    const json = (await response.json()) as T;
    if (json.status !== 'ok') {
      throw new Error(json.status_message ?? 'Unknown API error');
    }
    return json;
  } finally {
    clearTimeout(timeoutId);
  }
}

export class YtsApiDataSource implements YtsApi {
  constructor(private readonly resolveBaseUrl: () => string = () => DEFAULT_BASE_URL) {
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
    const query = searchParams.toString();
    const suffix = query ? `?${query}` : '';
    const baseUrl = this.resolveBaseUrl().replace(/\/+$/, '');
    const url = `${baseUrl}/${endpoint}${suffix}`;

    if (ttlMs > 0) {
      const cached = getCachedResponse<T>(url);
      if (cached) return cached;
    }

    const promise = fetchWithTimeout<T>(url).catch((error) => {
      responseCache.delete(url);
      throw error;
    });

    if (ttlMs > 0) setCachedResponse(url, promise, ttlMs);
    return promise;
  }
}
