import type {ImmutableRequest} from 'expo-router/server';
import {staticMetadata} from '@/core/config/seo';
import {AboutScreen} from '@/features/settings/screens/AboutScreen';

export function generateMetadata(request?: ImmutableRequest) {
  return staticMetadata('about', request?.headers.get('x-forwarded-host') ?? null);
}

export default function AboutRoute() {
  return <AboutScreen/>;
}
