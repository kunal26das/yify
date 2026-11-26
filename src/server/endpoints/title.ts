import {idParam, mediaTypeParam, notFound, queryParams, regionParam} from '@/server/http/params';
import {KB, withApi} from '@/server/http/respond';
import {getMovie, getTv} from '@/server/tmdb/titles';

export const titleRoute = withApi('title', {deadlineMs: 12_000, maxBytes: 80 * KB}, async ({url, params, signal}) => {
  const type = mediaTypeParam(params.type);
  const id = idParam(params.id);
  const region = regionParam(queryParams(url, ['region']).region);
  const title = type === 'movie' ? await getMovie(id, region, signal) : await getTv(id, region, signal);
  if (title === null) throw notFound('The title was not found.');
  return {body: {v: 2, title}, policy: 'detail', source: 'fixture'};
});
