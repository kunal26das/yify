// Web Remote Config via the Firebase JS SDK. Native uses `remote-config.ts`.
import {fetchAndActivate, getRemoteConfig, getString, isSupported, type RemoteConfig,} from 'firebase/remote-config';

import {DEFAULT_BASE_URL} from '@/data';

import {getFirebaseApp} from './firebase';

/** Remote Config parameter key holding the API base URL. */
export const API_BASE_URL_KEY = 'base_url_yify';

let remoteConfig: RemoteConfig | null = null;

/**
 * Fetch and activate Remote Config once at startup. No-ops gracefully when
 * Firebase is unconfigured or Remote Config is unsupported in this environment.
 */
export async function initRemoteConfig(): Promise<void> {
    if (remoteConfig != null) return;
    try {
        const app = getFirebaseApp();
        if (app == null || !(await isSupported())) return;
        const rc = getRemoteConfig(app);
        rc.defaultConfig = {[API_BASE_URL_KEY]: DEFAULT_BASE_URL};
        await fetchAndActivate(rc);
        remoteConfig = rc;
    } catch {
        // Keep using the in-app default.
    }
}

/** Current API base URL — the Remote Config value, or {@link DEFAULT_BASE_URL}. */
export function getApiBaseUrl(): string {
    if (remoteConfig == null) return DEFAULT_BASE_URL;
    try {
        return getString(remoteConfig, API_BASE_URL_KEY) || DEFAULT_BASE_URL;
    } catch {
        return DEFAULT_BASE_URL;
    }
}
