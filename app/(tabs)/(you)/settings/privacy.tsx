import type {ImmutableRequest} from 'expo-router/server';
import {staticMetadata} from '@/core/config/seo';
import {PrivacySettingsScreen} from '@/features/settings/screens/PrivacySettingsScreen';

export function generateMetadata(request?: ImmutableRequest) {
  return staticMetadata('privacy', request?.headers.get('x-forwarded-host') ?? null);
}

export default function PrivacyRoute() {
  return <PrivacySettingsScreen/>;
}
