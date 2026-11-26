import type {ImmutableRequest} from 'expo-router/server';
import {PersonRoute} from '@/features/person/screens/PersonRoute';

export async function generateMetadata(request: ImmutableRequest | undefined, params: Record<string, string | string[]>) {
  const {personMetadata} = await import('@/server/seo/personPage');
  return personMetadata(request, params);
}

export default function PersonPage() {
  return <PersonRoute/>;
}
