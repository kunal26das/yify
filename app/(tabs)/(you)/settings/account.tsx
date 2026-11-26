import type {ImmutableRequest} from 'expo-router/server';
import {staticMetadata} from '@/core/config/seo';
import {AccountSettingsScreen} from '@/features/account/screens/AccountSettingsScreen';

export function generateMetadata(request?: ImmutableRequest) {
  return staticMetadata('account', request?.headers.get('x-forwarded-host') ?? null);
}

export default function AccountRoute() {
  return <AccountSettingsScreen/>;
}
