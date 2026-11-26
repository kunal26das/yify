import type {GenresResponse, ProvidersResponse, RegionsResponse} from '@/core/domain/api';
import type {RegionCode} from '@/core/domain/providers';
import genres from './v2/genres.json';
import providersIN from './v2/providers.IN.json';
import providersUS from './v2/providers.US.json';
import regions from './v2/regions.json';

const PROVIDERS: Readonly<Record<string, ProvidersResponse>> = {
  IN: providersIN as unknown as ProvidersResponse,
  US: providersUS as unknown as ProvidersResponse,
};

export function fixtureGenres(): GenresResponse {
  return genres as unknown as GenresResponse;
}

export function fixtureRegions(): RegionsResponse {
  return regions as unknown as RegionsResponse;
}

export function fixtureProviders(region: RegionCode): ProvidersResponse {
  const providers = PROVIDERS[region] ?? PROVIDERS.US;
  return {...providers, region};
}
