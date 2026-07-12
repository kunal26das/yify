import {
  fetchAndActivate,
  getRemoteConfig,
  getString,
  setConfigSettings,
  setDefaults,
} from '@react-native-firebase/remote-config';

import {DEFAULT_BASE_URL} from '@/data';

export const API_BASE_URL_KEY = 'base_url_yify';

let initialized = false;

export async function initRemoteConfig(): Promise<void> {
    if (initialized) return;
    try {
        const rc = getRemoteConfig();
        await setConfigSettings(rc, {
            minimumFetchIntervalMillis: __DEV__ ? 0 : 60 * 60 * 1000,
        });
        await setDefaults(rc, {[API_BASE_URL_KEY]: DEFAULT_BASE_URL});
        await fetchAndActivate(rc);
        initialized = true;
    } catch {
    }
}

export function getApiBaseUrl(): string {
    try {
        return getString(getRemoteConfig(), API_BASE_URL_KEY) || DEFAULT_BASE_URL;
    } catch {
        return DEFAULT_BASE_URL;
    }
}
