import {queryParams, regionParam} from '@/server/http/params';
import {KB, withApi} from '@/server/http/respond';
import {fixtureProviders} from '@/server/fixtures/reference';

export const providersRoute = withApi('providers', {deadlineMs: 12_000, maxBytes: 80 * KB}, async ({url}) => {
  const query = queryParams(url, ['region']);
  return {body: fixtureProviders(regionParam(query.region)), policy: 'reference', source: 'fixture'};
});
