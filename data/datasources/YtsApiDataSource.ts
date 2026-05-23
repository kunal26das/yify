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

/** Full YTS API surface. */
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
  /**
   * @param resolveBaseUrl returns the API base URL for each request, so a
   * remotely-configured value (e.g. Firebase Remote Config, wired in the app
   * layer) takes effect without rebuilding the data source. Defaults to
   * {@link DEFAULT_BASE_URL}.
   */
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
    return this.request<YtsListMoviesResponse>(YtsEndpoint.ListMovies, searchParams);
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
    return this.request<YtsMovieDetailsResponse>(YtsEndpoint.MovieDetails, searchParams);
  }

  async getMovieSuggestions(movieId: number): Promise<YtsMovieSuggestionsResponse> {
    const searchParams = new URLSearchParams({movie_id: String(movieId)});
    return this.request<YtsMovieSuggestionsResponse>(YtsEndpoint.MovieSuggestions, searchParams);
  }

  async getMovieParentalGuides(movieId: number): Promise<YtsMovieParentalGuidesResponse> {
    const searchParams = new URLSearchParams({movie_id: String(movieId)});
    return this.request<YtsMovieParentalGuidesResponse>(
        YtsEndpoint.MovieParentalGuides,
        searchParams
    );
  }

  /** GET `endpoint` from the YTS API. */
  private async request<T extends YtsApiResponse<unknown>>(
      endpoint: YtsEndpoint,
      searchParams: URLSearchParams
  ): Promise<T> {
    const query = searchParams.toString();
    const suffix = query ? `?${query}` : '';
    const baseUrl = this.resolveBaseUrl().replace(/\/+$/, '');
    return fetchWithTimeout<T>(`${baseUrl}/${endpoint}${suffix}`);
  }
}
