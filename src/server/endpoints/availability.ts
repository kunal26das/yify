import type {AvailabilityResponse} from '@/core/domain/api';
import {availabilityRequest, queryParams, readJsonBody} from '@/server/http/params';
import {KB, withApi} from '@/server/http/respond';
import {emptyAvailability, fixtureAvailability, knownAvailabilityKey} from '@/server/fixtures/availability';

export const availabilityRoute = withApi('availability', {deadlineMs: 12_000, maxBytes: 200 * KB}, async ({url, request}) => {
  queryParams(url, []);
  const {region, keys} = availabilityRequest(await readJsonBody(request));
  const items: AvailabilityResponse['items'] = {};
  for (const key of keys) {
    items[key] = fixtureAvailability(region, key) ?? (knownAvailabilityKey(key) ? emptyAvailability(region) : null);
  }
  const body: AvailabilityResponse = {v: 2, region, items, failed: []};
  return {body, policy: 'availability', source: 'fixture'};
});
