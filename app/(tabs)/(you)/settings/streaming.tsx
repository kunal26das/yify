import type {ImmutableRequest} from 'expo-router/server';
import {staticMetadata} from '@/core/config/seo';
import {StreamingSettingsScreen} from '@/features/settings/screens/StreamingSettingsScreen';

export function generateMetadata(request?: ImmutableRequest) {
  return staticMetadata('streaming', request?.headers.get('x-forwarded-host') ?? null);
}

export default function StreamingRoute() {
  return <StreamingSettingsScreen/>;
}
