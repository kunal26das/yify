import {notFound, queryParams, v1IdParam} from '@/server/http/params';
import {KB, withApi} from '@/server/http/respond';
import {fixtureLegacyMovie} from '@/server/fixtures/mappings';

export const legacyMovieRoute = withApi('legacy-movie', {deadlineMs: 12_000, maxBytes: 4 * KB}, async ({url, params}) => {
  queryParams(url, []);
  const match = fixtureLegacyMovie(v1IdParam(params.v1Id));
  if (match === null) throw notFound('This old movie id is unknown.');
  return {body: match, policy: 'mapping', source: 'fixture'};
});
