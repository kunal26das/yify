import {environmentManager, QueryClient} from '@tanstack/react-query';
import {apiHealth} from '@/core/api/health';
import {retryDelay, shouldRetry} from './retry';

export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 5 * 60_000,
        gcTime: 30 * 60_000,
        retry: shouldRetry,
        retryDelay,
        refetchOnMount: true,
        refetchOnWindowFocus: () => !apiHealth.degraded(),
        refetchOnReconnect: () => !apiHealth.degraded(),
        networkMode: 'online',
        throwOnError: false,
      },
      mutations: {retry: false, networkMode: 'online'},
    },
  });
}

let browserClient: QueryClient | null = null;

export function getQueryClient(): QueryClient {
  if (environmentManager.isServer()) return createQueryClient();
  browserClient ??= createQueryClient();
  return browserClient;
}
