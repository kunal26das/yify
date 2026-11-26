import type {ImmutableRequest} from 'expo-router/server';
import {staticMetadata} from '@/core/config/seo';
import {PlaceholderScreen} from '@/features/shell/screens/PlaceholderScreen';

export function generateMetadata(request?: ImmutableRequest) {
  return staticMetadata('streaming', request?.headers.get('x-forwarded-host') ?? null);
}

export default function StreamingRoute() {
  return <PlaceholderScreen name="Region and services"/>;
}
