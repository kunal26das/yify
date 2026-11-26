import {idParam, notFound, queryParams, seasonParam} from '@/server/http/params';
import {KB, withApi} from '@/server/http/respond';
import {fixtureSeason} from '@/server/fixtures/titles';

export const seasonRoute = withApi('season', {deadlineMs: 12_000, maxBytes: 300 * KB}, async ({url, params}) => {
  queryParams(url, []);
  if (params.type !== 'tv') throw notFound('Seasons exist only for TV titles.');
  const season = fixtureSeason(idParam(params.id), seasonParam(params.season));
  if (season === null) throw notFound('The season was not found.');
  return {body: {v: 2, season}, policy: 'detail', source: 'fixture'};
});
