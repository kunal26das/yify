import {queryParams} from '@/server/http/params';
import {KB, withApi} from '@/server/http/respond';
import {fixtureGenres} from '@/server/fixtures/reference';

export const genresRoute = withApi('genres', {deadlineMs: 12_000, maxBytes: 8 * KB}, async ({url}) => {
  queryParams(url, []);
  return {body: fixtureGenres(), policy: 'reference', source: 'fixture'};
});
