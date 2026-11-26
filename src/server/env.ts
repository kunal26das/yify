export const TMDB_API_BASE_URL_DEFAULT = 'https://api.themoviedb.org/3';
export const FIREBASE_AUTH_HOST_DEFAULT = 'yify-2da67.firebaseapp.com';

export type TmdbKeySource = 'env' | 'fallback' | 'fixtures';
export type LegacyCatalogMode = 'on' | 'gone';

function clean(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

export function fixturesEnabled(): boolean {
  return clean(process.env.YIFY_API_FIXTURES) === '1';
}

export function tmdbApiBaseUrl(): string {
  return (clean(process.env.TMDB_API_BASE_URL) ?? TMDB_API_BASE_URL_DEFAULT).replace(/\/+$/, '');
}

export function tmdbApiKey(): string | null {
  return clean(process.env.TMDB_API_KEY) ?? null;
}

export function tmdbKeySource(): TmdbKeySource {
  if (fixturesEnabled()) return 'fixtures';
  return tmdbApiKey() === null ? 'fallback' : 'env';
}

export function legacyCatalogMode(): LegacyCatalogMode {
  return clean(process.env.YIFY_LEGACY_CATALOG) === 'gone' ? 'gone' : 'on';
}

export function firebaseAuthHost(): string {
  return clean(process.env.FIREBASE_AUTH_HOST) ?? FIREBASE_AUTH_HOST_DEFAULT;
}
