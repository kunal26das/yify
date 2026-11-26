import type {ImmutableRequest} from 'expo-router/server';
import {staticMetadata} from '@/core/config/seo';
import {PlaceholderScreen} from '@/features/shell/screens/PlaceholderScreen';

export function generateMetadata(request?: ImmutableRequest) {
  return staticMetadata('you', request?.headers.get('x-forwarded-host') ?? null);
}

export default function YouRoute() {
  return <PlaceholderScreen name="You"/>;
}
