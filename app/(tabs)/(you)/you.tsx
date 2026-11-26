import type {ImmutableRequest} from 'expo-router/server';
import {staticMetadata} from '@/core/config/seo';
import {YouScreen} from '@/features/you/screens/YouScreen';

export function generateMetadata(request?: ImmutableRequest) {
  return staticMetadata('you', request?.headers.get('x-forwarded-host') ?? null);
}

export default function YouRoute() {
  return <YouScreen/>;
}
