import {
  fetchAndActivate,
  getRemoteConfig,
  getString,
  setConfigSettings,
  setDefaults,
} from '@react-native-firebase/remote-config';

import {AD_COOLDOWN_MS, AD_WINDOW_LIMIT, type AppConfig} from '@/domain';
import {DEFAULT_BASE_URL, secureBaseUrl} from '../datasources/YtsApiDataSource';
import {
  ADS_COOLDOWN_SECONDS_DEFAULT,
  ADS_COOLDOWN_SECONDS_KEY,
  ADS_DAILY_CAP_DEFAULT,
  ADS_DAILY_CAP_KEY,
  ADS_ENABLED_DEFAULT,
  ADS_ENABLED_KEY,
  ADS_INTERSTITIAL_UNIT_KEY,
  API_BASE_URL_KEY,
  CONFIG_TIMEOUT_MS,
  SUPPORT_URL_DEFAULT,
  SUPPORT_URL_KEY,
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
      return secureBaseUrl(getString(getRemoteConfig(), API_BASE_URL_KEY));
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

  getAdsEnabled(): boolean {
    try {
      return getString(getRemoteConfig(), ADS_ENABLED_KEY) === 'true';
    } catch {
      return false;
    }
  }

  getAdUnitId(): string {
    try {
      return getString(getRemoteConfig(), ADS_INTERSTITIAL_UNIT_KEY);
    } catch {
      return '';
    }
  }

  getAdCooldownMs(): number {
    try {
      const seconds = Number.parseInt(
        getString(getRemoteConfig(), ADS_COOLDOWN_SECONDS_KEY),
        10
      );
      return Number.isFinite(seconds) && seconds >= 0 ? seconds * 1000 : AD_COOLDOWN_MS;
    } catch {
      return AD_COOLDOWN_MS;
    }
  }

  getAdDailyCap(): number {
    try {
      const cap = Number.parseInt(getString(getRemoteConfig(), ADS_DAILY_CAP_KEY), 10);
      return Number.isFinite(cap) && cap >= 0 ? cap : AD_WINDOW_LIMIT;
    } catch {
      return AD_WINDOW_LIMIT;
    }
  }

  getSupportUrl(): string {
    try {
      return getString(getRemoteConfig(), SUPPORT_URL_KEY) || SUPPORT_URL_DEFAULT;
    } catch {
      return SUPPORT_URL_DEFAULT;
    }
  }

  private async doInit(): Promise<void> {
    if (this.initialized) return;
    try {
      const rc = getRemoteConfig();
      await setConfigSettings(rc, {
        minimumFetchIntervalMillis: __DEV__ ? 0 : 60 * 60 * 1000,
      });
      await setDefaults(rc, {
        [API_BASE_URL_KEY]: DEFAULT_BASE_URL,
        [TMDB_API_KEY]: '',
        [ADS_ENABLED_KEY]: ADS_ENABLED_DEFAULT,
        [ADS_INTERSTITIAL_UNIT_KEY]: '',
        [ADS_COOLDOWN_SECONDS_KEY]: ADS_COOLDOWN_SECONDS_DEFAULT,
        [ADS_DAILY_CAP_KEY]: ADS_DAILY_CAP_DEFAULT,
        [SUPPORT_URL_KEY]: SUPPORT_URL_DEFAULT,
      });
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
