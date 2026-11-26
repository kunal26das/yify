import type {GeoResponse} from '@/core/domain/api';
import {queryParams} from '@/server/http/params';
import {KB, withApi} from '@/server/http/respond';

export function countryFromHeader(value: string | null): string | null {
  const country = value?.trim().toUpperCase() ?? '';
  return /^[A-Z]{2}$/.test(country) && country !== 'XX' && country !== 'T1' ? country : null;
}

export const geoRoute = withApi('geo', {deadlineMs: 12_000, maxBytes: KB}, async ({url, request}) => {
  queryParams(url, []);
  const body: GeoResponse = {v: 2, country: countryFromHeader(request.headers.get('eas-ip-country'))};
  return {body, policy: 'private', source: 'upstream'};
});
