import type {ImmutableRequest} from 'expo-router/server';
import {staticMetadata} from '@/core/config/seo';
import {SearchScreen} from '@/features/search/screens/SearchScreen';

export function generateMetadata(request?: ImmutableRequest) {
  return staticMetadata('search', request?.headers.get('x-forwarded-host') ?? null);
}

export default function SearchRoute() {
  return <SearchScreen/>;
}
