import type {ImmutableRequest} from 'expo-router/server';
import {TitleRoute} from '@/features/title/screens/TitleRoute';

export async function generateMetadata(request: ImmutableRequest | undefined, params: Record<string, string | string[]>) {
  const {titleMetadata} = await import('@/server/seo/titlePage');
  return titleMetadata('tv', request, params);
}

export default function TvRoute() {
  return <TitleRoute type="tv"/>;
}
