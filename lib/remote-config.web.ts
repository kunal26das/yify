import {fetchAndActivate, getRemoteConfig, getString, isSupported, type RemoteConfig,} from 'firebase/remote-config';

import {DEFAULT_BASE_URL} from '@/data';

import {getFirebaseApp} from './firebase';

export const API_BASE_URL_KEY = 'base_url_yify';
export const TMDB_API_KEY = 'tmdb_api_key';

let remoteConfig: RemoteConfig | null = null;
let readyPromise: Promise<void> | null = null;

export function remoteConfigReady(): Promise<void> {
    return readyPromise ?? Promise.resolve();
}

export async function initRemoteConfig(): Promise<void> {
    readyPromise = readyPromise ?? doInit();
    return readyPromise;
}

async function doInit(): Promise<void> {
    if (remoteConfig != null) return;
    try {
        const app = getFirebaseApp();
        if (app == null || !(await isSupported())) return;
        const rc = getRemoteConfig(app);
        rc.defaultConfig = {[API_BASE_URL_KEY]: DEFAULT_BASE_URL, [TMDB_API_KEY]: ''};
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


export function getTmdbApiKey(): string {
    if (remoteConfig == null) return '';
    try {
        return getString(remoteConfig, TMDB_API_KEY);
    } catch {
        return '';
    }
}
