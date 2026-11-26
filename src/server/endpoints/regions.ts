import {queryParams} from '@/server/http/params';
import {KB, withApi} from '@/server/http/respond';
import {fixtureRegions} from '@/server/fixtures/reference';

export const regionsRoute = withApi('regions', {deadlineMs: 12_000, maxBytes: 20 * KB}, async ({url}) => {
  queryParams(url, []);
  return {body: fixtureRegions(), policy: 'reference', source: 'fixture'};
});
