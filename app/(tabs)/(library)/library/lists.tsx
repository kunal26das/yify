import type {ImmutableRequest} from 'expo-router/server';
import {staticMetadata} from '@/core/config/seo';
import {ListsScreen} from '@/features/library/screens/ListsScreen';

export function generateMetadata(request?: ImmutableRequest) {
  return staticMetadata('lists', request?.headers.get('x-forwarded-host') ?? null);
}

export default function ListsRoute() {
  return <ListsScreen/>;
}
