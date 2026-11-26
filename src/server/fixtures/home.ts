import type {HomeResponse} from '@/core/domain/api';
import type {RegionCode} from '@/core/domain/providers';
import homeIN from './v2/home.IN.json';
import homeUS from './v2/home.US.json';

const HOME: Readonly<Record<string, HomeResponse>> = {
  IN: homeIN as unknown as HomeResponse,
  US: homeUS as unknown as HomeResponse,
};

export function fixtureHome(region: RegionCode): HomeResponse {
  const home = HOME[region] ?? HOME.US;
  return {...home, region};
}
