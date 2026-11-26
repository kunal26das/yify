export const TMDB_API_BASE_URL_DEFAULT = 'https://api.themoviedb.org/3';

export function fixturesEnabled(): boolean {
  return process.env.YIFY_API_FIXTURES === '1';
}

export function tmdbApiBaseUrl(): string {
  return process.env.TMDB_API_BASE_URL ?? TMDB_API_BASE_URL_DEFAULT;
}

export function tmdbKeySource(): 'env' | 'fallback' | 'fixtures' {
  if (fixturesEnabled()) return 'fixtures';
  return process.env.TMDB_API_KEY ? 'env' : 'fallback';
}

export function traceEnabled(): boolean {
  return process.env.S1_TRACE === '1';
}
