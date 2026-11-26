import {idParam, notFound, queryParams} from '@/server/http/params';
import {KB, withApi} from '@/server/http/respond';
import {getPerson} from '@/server/tmdb/titles';

export const personRoute = withApi('person', {deadlineMs: 12_000, maxBytes: 200 * KB}, async ({url, params, signal}) => {
  queryParams(url, []);
  const person = await getPerson(idParam(params.id), signal);
  if (person === null) throw notFound('The person was not found.');
  return {body: {v: 2, person}, policy: 'person', source: 'fixture'};
});
