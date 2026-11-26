import {queryParams, regionParam} from '@/server/http/params';
import {KB, withApi} from '@/server/http/respond';
import {fixtureHome} from '@/server/fixtures/home';

export const homeRoute = withApi('home', {deadlineMs: 12_000, maxBytes: 150 * KB}, async ({url}) => {
  const query = queryParams(url, ['region']);
  return {body: fixtureHome(regionParam(query.region)), policy: 'list', source: 'fixture'};
});
