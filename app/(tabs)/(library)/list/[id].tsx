import type {ImmutableRequest} from 'expo-router/server';
import {staticMetadata} from '@/core/config/seo';
import {PlaceholderScreen} from '@/features/shell/screens/PlaceholderScreen';

export function generateMetadata(request?: ImmutableRequest) {
  return staticMetadata('list', request?.headers.get('x-forwarded-host') ?? null);
}

export default function ListRoute() {
  return <PlaceholderScreen name="List"/>;
}
