import type {ImmutableRequest} from 'expo-router/server';
import {staticMetadata} from '@/core/config/seo';
import {RecentScreen} from '@/features/library/screens/RecentScreen';

export function generateMetadata(request?: ImmutableRequest) {
  return staticMetadata('recent', request?.headers.get('x-forwarded-host') ?? null);
}

export default function RecentRoute() {
  return <RecentScreen/>;
}
