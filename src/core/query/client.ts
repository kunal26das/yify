import {QueryClient} from '@tanstack/react-query';

export const DEFAULT_STALE_MS = 5 * 60_000;

export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {queries: {staleTime: DEFAULT_STALE_MS, retry: 1, refetchOnWindowFocus: false}},
  });
}
