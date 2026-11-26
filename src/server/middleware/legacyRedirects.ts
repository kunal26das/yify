import type {ImmutableRequest} from 'expo-router/server';

export async function legacyRedirect(_request: ImmutableRequest): Promise<Response | undefined> {
  return undefined;
}
