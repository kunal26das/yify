import type {ProvidersResponse} from '@/core/domain/api';
import type {RegionCode} from '@/core/domain/providers';
import providersIN from './v2/providers.IN.json';
import providersUS from './v2/providers.US.json';

const PROVIDERS: Readonly<Record<string, ProvidersResponse>> = {
  IN: providersIN as unknown as ProvidersResponse,
  US: providersUS as unknown as ProvidersResponse,
};

export function fixtureProviders(region: RegionCode): ProvidersResponse {
  const providers = PROVIDERS[region] ?? PROVIDERS.US;
  return {...providers, region};
}
