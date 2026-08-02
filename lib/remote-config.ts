import {
  fetchAndActivate,
  getRemoteConfig,
  getString,
  setConfigSettings,
  setDefaults,
} from '@react-native-firebase/remote-config';

import {DEFAULT_BASE_URL} from '@/data';

export const API_BASE_URL_KEY = 'base_url_yify';
export const TMDB_API_KEY = 'tmdb_api_key';
const TMDB_FALLBACK_KEY = '27348b00a69a63a9825b9ec3532f2246';

let initialized = false;
let readyPromise: Promise<void> | null = null;
let lastError: string | null = null;

export function remoteConfigReady(): Promise<void> {
    return initRemoteConfig();
}

export async function initRemoteConfig(): Promise<void> {
    readyPromise = readyPromise ?? doInit();
    return readyPromise;
}

async function doInit(): Promise<void> {
    if (initialized) return;
    try {
        const rc = getRemoteConfig();
        await setConfigSettings(rc, {
            minimumFetchIntervalMillis: __DEV__ ? 0 : 60 * 60 * 1000,
        });
        await setDefaults(rc, {[API_BASE_URL_KEY]: DEFAULT_BASE_URL, [TMDB_API_KEY]: ''});
        await fetchAndActivate(rc);
        initialized = true;
    } catch (error) {
        lastError = error instanceof Error ? error.message : String(error);
    }
}

export function remoteConfigError(): string | null {
    return lastError;
}

export function getApiBaseUrl(): string {
    try {
        return getString(getRemoteConfig(), API_BASE_URL_KEY) || DEFAULT_BASE_URL;
    } catch {
        return DEFAULT_BASE_URL;
    }
}

export function getTmdbApiKey(): string {
    try {
        return getString(getRemoteConfig(), TMDB_API_KEY) || TMDB_FALLBACK_KEY;
    } catch {
        return TMDB_FALLBACK_KEY;
    }
}
