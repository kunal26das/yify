import type {ResolveResponse} from '@/core/domain/api';
import {queryParams, readJsonBody, resolveRequest} from '@/server/http/params';
import {KB, withApi} from '@/server/http/respond';
import {fixtureFind, fixtureLegacyMovie} from '@/server/fixtures/mappings';

export const resolveRoute = withApi('resolve', {deadlineMs: 20_000, maxBytes: 120 * KB}, async ({url, request}) => {
  queryParams(url, []);
  const {imdb, v1} = resolveRequest(await readJsonBody(request));
  const body: ResolveResponse = {v: 2, imdb: {}, v1: {}, failed: {imdb: [], v1: []}};
  for (const id of imdb) body.imdb[id] = fixtureFind(id)?.match ?? null;
  for (const candidate of v1) body.v1[String(candidate.id)] = fixtureLegacyMovie(candidate.id)?.match ?? null;
  return {body, policy: 'resolve', source: 'fixture'};
});
