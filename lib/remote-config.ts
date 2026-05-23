// Native (iOS/Android) Remote Config via @react-native-firebase.
// The web counterpart lives in `remote-config.web.ts`.
import {
  fetchAndActivate,
  getRemoteConfig,
  getString,
  setConfigSettings,
  setDefaults,
} from '@react-native-firebase/remote-config';

import {DEFAULT_BASE_URL} from '@/data';

/** Remote Config parameter key holding the API base URL. */
export const API_BASE_URL_KEY = 'base_url_yify';

let initialized = false;

/**
 * Fetch and activate Remote Config once at startup. Safe to call unconditionally:
 * any failure (no Firebase config, offline) is swallowed and the in-app default
 * is used.
 */
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
        // Keep using the in-app default.
    }
}

/** Current API base URL — the Remote Config value, or {@link DEFAULT_BASE_URL}. */
export function getApiBaseUrl(): string {
    try {
        return getString(getRemoteConfig(), API_BASE_URL_KEY) || DEFAULT_BASE_URL;
    } catch {
        return DEFAULT_BASE_URL;
    }
}
