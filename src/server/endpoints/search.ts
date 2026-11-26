import {pageParam, queryParams, searchQueryParam, searchTypeParam} from '@/server/http/params';
import {KB, withApi} from '@/server/http/respond';
import {fixtureSearch} from '@/server/fixtures/lists';

export const searchRoute = withApi('search', {deadlineMs: 12_000, maxBytes: 60 * KB}, async ({url}) => {
  const query = queryParams(url, ['q', 'type', 'page']);
  const body = fixtureSearch(searchQueryParam(query.q), searchTypeParam(query.type), pageParam(query.page));
  return {body, policy: 'search', source: 'fixture'};
});
