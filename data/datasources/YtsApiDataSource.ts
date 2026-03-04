import type { YtsListMoviesResponse } from '@/data/models/YtsApiResponse';

const BASE_URLS = [
  'https://movies-api.accel.li/api/v2',
  'https://yts.bz/api/v2',
];

export interface ListMoviesApiParams {
  page: number;
  limit?: number;
  query?: string;
  quality?: string;
  minimum_rating?: number;
  genre?: string;
  sort_by?: string;
  order_by?: 'asc' | 'desc';
}

export interface ListMoviesApi {
  listMovies(params: ListMoviesApiParams): Promise<YtsListMoviesResponse>;
}

async function fetchWithTimeout(url: string): Promise<YtsListMoviesResponse> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15000);

  const response = await fetch(url, { signal: controller.signal });
  clearTimeout(timeoutId);

  if (!response.ok) {
    throw new Error(`API error: ${response.status}`);
  }

  const json = (await response.json()) as YtsListMoviesResponse;
  if (json.status !== 'ok') {
    throw new Error(json.status_message ?? 'Unknown API error');
  }
  return json;
}

export class YtsApiDataSource implements ListMoviesApi {
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
    const query = searchParams.toString();

    let lastError: Error | null = null;
    for (const baseUrl of BASE_URLS) {
      try {
        return await fetchWithTimeout(`${baseUrl}/list_movies.json?${query}`);
      } catch (e) {
        lastError = e instanceof Error ? e : new Error(String(e));
      }
    }
    throw lastError ?? new Error('Failed to load movies');
  }
}
