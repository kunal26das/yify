import {APP_VERSION} from '@/core/config/app';

export const API_ORIGIN = '';
export const CLIENT_HEADER = `web/${APP_VERSION}`;

export function apiUrl(path: string): string {
  return `/api/v2${path}`;
}
