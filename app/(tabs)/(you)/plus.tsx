import type {ImmutableRequest} from 'expo-router/server';
import {staticMetadata} from '@/core/config/seo';
import {PlusScreen} from '@/features/monetization/screens/PlusScreen';

export function generateMetadata(request?: ImmutableRequest) {
  return staticMetadata('plus', request?.headers.get('x-forwarded-host') ?? null);
}

export default function PlusRoute() {
  return <PlusScreen/>;
}
