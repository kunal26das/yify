import type {HealthResponse} from '@/core/domain/api';
import {queryParams} from '@/server/http/params';
import {KB, withApi} from '@/server/http/respond';

export const healthRoute = withApi('health', {deadlineMs: 12_000, maxBytes: KB}, async ({url}) => {
  queryParams(url, []);
  const body: HealthResponse = {v: 2, ok: true, upstream: 'ok', legacy: 'ok', tmdbKey: 'fixtures'};
  return {body, policy: 'private', source: 'fixture'};
});
