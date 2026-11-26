import {imdbIdParam, notFound, queryParams} from '@/server/http/params';
import {KB, withApi} from '@/server/http/respond';
import {fixtureFind} from '@/server/fixtures/mappings';

export const findRoute = withApi('find', {deadlineMs: 12_000, maxBytes: 4 * KB}, async ({url, params}) => {
  queryParams(url, []);
  const match = fixtureFind(imdbIdParam(params.imdbId));
  if (match === null) throw notFound('No title has this IMDb id.');
  return {body: match, policy: 'mapping', source: 'fixture'};
});
