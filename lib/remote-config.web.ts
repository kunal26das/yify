import {fetchAndActivate, getRemoteConfig, getString, isSupported, type RemoteConfig,} from 'firebase/remote-config';

import {DEFAULT_BASE_URL} from '@/data';

import {getFirebaseApp} from './firebase';

export const API_BASE_URL_KEY = 'base_url_yify';

let remoteConfig: RemoteConfig | null = null;

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
    }
}

export function getApiBaseUrl(): string {
    if (remoteConfig == null) return DEFAULT_BASE_URL;
    try {
        return getString(remoteConfig, API_BASE_URL_KEY) || DEFAULT_BASE_URL;
    } catch {
        return DEFAULT_BASE_URL;
    }
}
