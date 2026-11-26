import type {ImmutableRequest} from 'expo-router/server';

export function legacyRedirect(request: ImmutableRequest): Response | undefined {
  return request.method === 'S1' ? new Response(null, {status: 204}) : undefined;
}
