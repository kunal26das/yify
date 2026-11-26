import {useQuery} from '@tanstack/react-query';
import type {Preferences} from '@/core/domain/preferences';
import type {CatalogProvider, Region, RegionCode} from '@/core/domain/providers';
import {providersQueryOptions, regionsQueryOptions} from '@/core/query/options';
import {getPreferences, setPreference, usePreferences} from './preferences';

type Status = 'loading' | 'ready' | 'error';

const NO_REGIONS: readonly Region[] = [];
const NO_PROVIDERS: readonly CatalogProvider[] = [];
const NO_SERVICES: readonly number[] = [];

function statusOf(hasData: boolean, isError: boolean): Status {
  if (hasData) return 'ready';
  return isError ? 'error' : 'loading';
}

export function useRegions(): {regions: readonly Region[]; status: Status; retry(): void} {
  const query = useQuery(regionsQueryOptions());
  return {
    regions: query.data ?? NO_REGIONS,
    status: statusOf(query.data !== undefined, query.isError),
    retry: () => {
      void query.refetch();
    },
  };
}

export function useProviderCatalog(region: RegionCode): {providers: readonly CatalogProvider[]; status: Status; retry(): void} {
  const query = useQuery(providersQueryOptions(region));
  return {
    providers: query.data ?? NO_PROVIDERS,
    status: statusOf(query.data !== undefined, query.isError),
    retry: () => {
      void query.refetch();
    },
  };
}

export function useMyServices(region: RegionCode): readonly number[] {
  return usePreferences((preferences: Preferences) => preferences.services[region] ?? NO_SERVICES);
}

export function setMyServices(region: RegionCode, providerIds: readonly number[]): void {
  setPreference('services', {...getPreferences().services, [region]: [...providerIds]});
}
