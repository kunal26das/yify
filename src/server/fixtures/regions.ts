import type {RegionsResponse} from '@/core/domain/api';
import regions from './v2/regions.json';

export function fixtureRegions(): RegionsResponse {
  return regions as unknown as RegionsResponse;
}
