import type {ImmutableRequest} from 'expo-router/server';
import {staticMetadata} from '@/core/config/seo';
import {SettingsScreen} from '@/features/settings/screens/SettingsScreen';

export function generateMetadata(request?: ImmutableRequest) {
  return staticMetadata('settings', request?.headers.get('x-forwarded-host') ?? null);
}

export default function SettingsRoute() {
  return <SettingsScreen/>;
}
