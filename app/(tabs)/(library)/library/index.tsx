import type {ImmutableRequest} from 'expo-router/server';
import {staticMetadata} from '@/core/config/seo';
import {WatchlistScreen} from '@/features/library/screens/WatchlistScreen';

export function generateMetadata(request?: ImmutableRequest) {
  return staticMetadata('watchlist', request?.headers.get('x-forwarded-host') ?? null);
}

export default function WatchlistRoute() {
  return <WatchlistScreen/>;
}
