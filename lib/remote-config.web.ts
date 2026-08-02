import {fetchAndActivate, getRemoteConfig, getString, type RemoteConfig} from 'firebase/remote-config';

import {DEFAULT_BASE_URL} from '@/data';

import {getFirebaseApp} from './firebase';

export const API_BASE_URL_KEY = 'base_url_yify';
export const TMDB_API_KEY = 'tmdb_api_key';
const TMDB_FALLBACK_KEY = '27348b00a69a63a9825b9ec3532f2246';

const INIT_TIMEOUT_MS = 4000;

let remoteConfig: RemoteConfig | null = null;
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
    if (remoteConfig != null) return;
    try {
        const app = getFirebaseApp();
        if (app == null) {
            lastError = 'firebase app unavailable';
            return;
        }
        const rc = getRemoteConfig(app);
        rc.defaultConfig = {[API_BASE_URL_KEY]: DEFAULT_BASE_URL, [TMDB_API_KEY]: ''};
        await Promise.race([
            fetchAndActivate(rc).then(() => {
                remoteConfig = rc;
            }),
            new Promise<void>((resolve) => {
                setTimeout(() => {
                    lastError = lastError ?? 'remote config timed out';
                    resolve();
                }, INIT_TIMEOUT_MS);
            }),
        ]);
    } catch (error) {
        lastError = error instanceof Error ? error.message : String(error);
    }
}

export function remoteConfigError(): string | null {
    return lastError;
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
    if (remoteConfig == null) return TMDB_FALLBACK_KEY;
    try {
        return getString(remoteConfig, TMDB_API_KEY) || TMDB_FALLBACK_KEY;
    } catch {
        return TMDB_FALLBACK_KEY;
    }
}
