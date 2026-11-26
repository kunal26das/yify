import {APP_VERSION} from '@/core/config/app';

export const API_ORIGIN: string = process.env.EXPO_PUBLIC_API_ORIGIN || 'https://yify.expo.app';
export const CLIENT_HEADER = `android/${APP_VERSION}`;

export function apiUrl(path: string): string {
  return `${API_ORIGIN}/api/v2${path}`;
}
