import {
  fetchAndActivate,
  getRemoteConfig,
  getString,
  type RemoteConfig,
} from 'firebase/remote-config';

import {AD_COOLDOWN_MS, type AppConfig} from '@/domain';
import {DEFAULT_BASE_URL} from '../datasources/YtsApiDataSource';
import {getFirebaseApp} from '../datasources/firebase/FirebaseWebApp';
import {
  API_BASE_URL_KEY,
  CONFIG_TIMEOUT_MS,
  TMDB_API_KEY,
  TMDB_FALLBACK_KEY,
} from '../datasources/config/remoteConfigKeys';

export class RemoteAppConfig implements AppConfig {
  private remoteConfig: RemoteConfig | null = null;
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
    if (this.remoteConfig == null) return DEFAULT_BASE_URL;
    try {
      return getString(this.remoteConfig, API_BASE_URL_KEY) || DEFAULT_BASE_URL;
    } catch {
      return DEFAULT_BASE_URL;
    }
  }

  getTmdbApiKey(): string {
    if (this.remoteConfig == null) return TMDB_FALLBACK_KEY;
    try {
      return getString(this.remoteConfig, TMDB_API_KEY) || TMDB_FALLBACK_KEY;
    } catch {
      return TMDB_FALLBACK_KEY;
    }
  }

  getAdsEnabled(): boolean {
    return false;
  }

  getAdUnitId(): string {
    return '';
  }

  getAdCooldownMs(): number {
    return AD_COOLDOWN_MS;
  }

  private async doInit(): Promise<void> {
    if (this.remoteConfig != null) return;
    try {
      const app = getFirebaseApp();
      if (app == null) {
        this.lastError = 'firebase app unavailable';
        return;
      }
      const rc = getRemoteConfig(app);
      rc.defaultConfig = {[API_BASE_URL_KEY]: DEFAULT_BASE_URL, [TMDB_API_KEY]: ''};
      await Promise.race([
        fetchAndActivate(rc).then(() => {
          this.remoteConfig = rc;
        }),
        new Promise<void>((resolve) => {
          setTimeout(() => {
            this.lastError = this.lastError ?? 'remote config timed out';
            resolve();
          }, CONFIG_TIMEOUT_MS);
        }),
      ]);
    } catch (error) {
      this.lastError = error instanceof Error ? error.message : String(error);
    }
  }
}
