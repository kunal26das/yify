import {discoverParams} from '@/server/http/params';
import {KB, withApi} from '@/server/http/respond';
import {fixtureDiscover} from '@/server/fixtures/lists';

export const discoverRoute = withApi('discover', {deadlineMs: 12_000, maxBytes: 60 * KB}, async ({url}) => {
  const {params} = discoverParams(url);
  return {body: fixtureDiscover(params.type), policy: 'list', source: 'fixture'};
});
