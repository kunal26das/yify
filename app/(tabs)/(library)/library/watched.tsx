import type {ImmutableRequest} from 'expo-router/server';
import {staticMetadata} from '@/core/config/seo';
import {DiaryScreen} from '@/features/library/screens/DiaryScreen';

export function generateMetadata(request?: ImmutableRequest) {
  return staticMetadata('watched', request?.headers.get('x-forwarded-host') ?? null);
}

export default function WatchedRoute() {
  return <DiaryScreen/>;
}
