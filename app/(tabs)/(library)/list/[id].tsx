import type {ImmutableRequest} from 'expo-router/server';
import {staticMetadata} from '@/core/config/seo';
import {ListScreen} from '@/features/library/screens/ListScreen';

export function generateMetadata(request?: ImmutableRequest) {
  return staticMetadata('list', request?.headers.get('x-forwarded-host') ?? null);
}

export default function ListRoute() {
  return <ListScreen/>;
}
