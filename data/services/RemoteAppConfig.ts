import {
  fetchAndActivate,
  getRemoteConfig,
  getString,
  setConfigSettings,
  setDefaults,
} from '@react-native-firebase/remote-config';

import type {AppConfig} from '@/domain';
import {DEFAULT_BASE_URL} from '../datasources/YtsApiDataSource';
import {
  API_BASE_URL_KEY,
  CONFIG_TIMEOUT_MS,
  TMDB_API_KEY,
  TMDB_FALLBACK_KEY,
} from '../datasources/config/remoteConfigKeys';

export class RemoteAppConfig implements AppConfig {
  private initialized = false;
  private readyPromise: Promise<void> | null = null;
  private lastError: string | null = null;

  init(): Promise<void> {
    this.readyPromise = this.readyPromise ?? this.doInit();
    return this.readyPromise;
  }

  ready(): Promise<void> {
    return this.init();
  }

  error(): string | null {
    return this.lastError;
  }

  getApiBaseUrl(): string {
    try {
      return getString(getRemoteConfig(), API_BASE_URL_KEY) || DEFAULT_BASE_URL;
    } catch {
      return DEFAULT_BASE_URL;
    }
  }

  getTmdbApiKey(): string {
    try {
      return getString(getRemoteConfig(), TMDB_API_KEY) || TMDB_FALLBACK_KEY;
    } catch {
      return TMDB_FALLBACK_KEY;
    }
  }

  private async doInit(): Promise<void> {
    if (this.initialized) return;
    try {
      const rc = getRemoteConfig();
      await setConfigSettings(rc, {
        minimumFetchIntervalMillis: __DEV__ ? 0 : 60 * 60 * 1000,
      });
      await setDefaults(rc, {[API_BASE_URL_KEY]: DEFAULT_BASE_URL, [TMDB_API_KEY]: ''});
      await Promise.race([
        fetchAndActivate(rc),
        new Promise<void>((resolve) => setTimeout(resolve, CONFIG_TIMEOUT_MS)),
      ]);
      this.initialized = true;
    } catch (error) {
      this.lastError = error instanceof Error ? error.message : String(error);
    }
  }
}
