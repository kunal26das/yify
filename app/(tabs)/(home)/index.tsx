import type {ImmutableRequest} from 'expo-router/server';
import {staticMetadata} from '@/core/config/seo';
import {HomeScreen} from '@/features/home/screens/HomeScreen';

export function generateMetadata(request?: ImmutableRequest) {
  return staticMetadata('home', request?.headers.get('x-forwarded-host') ?? null);
}

export default function HomeRoute() {
  return <HomeScreen/>;
}
