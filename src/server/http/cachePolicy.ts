export const CACHE_POLICIES = {
  list: 'public, max-age=300, s-maxage=900, stale-while-revalidate=3600, stale-if-error=604800',
  search: 'public, max-age=300, s-maxage=3600, stale-while-revalidate=86400, stale-if-error=604800',
  detail: 'public, max-age=600, s-maxage=21600, stale-while-revalidate=86400, stale-if-error=604800',
  person: 'public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800, stale-if-error=604800',
  reference: 'public, max-age=86400, s-maxage=604800, stale-while-revalidate=604800, stale-if-error=2592000',
  mapping: 'public, max-age=86400, s-maxage=2592000, stale-while-revalidate=2592000, stale-if-error=2592000',
  availability: 'public, max-age=0, s-maxage=21600, stale-while-revalidate=86400, stale-if-error=604800',
  resolve: 'public, max-age=0, s-maxage=86400, stale-if-error=604800',
  image: 'public, max-age=31536000, s-maxage=31536000, immutable',
  lastGood: 'public, max-age=60, s-maxage=60',
  private: 'private, no-store',
} as const;

export type CachePolicyName = keyof typeof CACHE_POLICIES;

export const ERROR_CACHE_CONTROL: Readonly<Record<number, string>> = {
  400: 'public, max-age=60, s-maxage=3600',
  404: 'public, max-age=3600, s-maxage=86400',
};

export function errorCacheControl(status: number): string {
  return ERROR_CACHE_CONTROL[status] ?? 'no-store';
}
