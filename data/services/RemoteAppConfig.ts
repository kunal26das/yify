import {
  fetchAndActivate,
  getRemoteConfig,
  getString,
} from '@react-native-firebase/remote-config';

import type {AppConfig, Diagnostics, DiagnosticSpan, NetworkMonitor} from '@/domain';
import {NOOP_DIAGNOSTICS} from './NoopDiagnostics';
import {DEFAULT_BASE_URL, secureBaseUrl} from '../datasources/YtsApiDataSource';
import {
  API_BASE_URL_KEY,
  CONFIG_TIMEOUT_MS,
  SUPPORT_URL_DEFAULT,
  SUPPORT_URL_KEY,
  TMDB_API_KEY,
  TMDB_FALLBACK_KEY,
} from '../datasources/config/remoteConfigKeys';

export class RemoteAppConfig implements AppConfig {
  constructor(
    private readonly diagnostics: Diagnostics = NOOP_DIAGNOSTICS,
    private readonly network?: NetworkMonitor,
  ) {
    network?.subscribe(() => {
      if (this.startRequested && network.isOnline()) {
        this.retryAt = 0;
        void this.init();
      }
    });
  }
  private initialized = false;
  private startRequested = false;
  private readyPromise: Promise<void> | null = null;
  private lastError: string | null = null;
  private retryAt = 0;

  init(): Promise<void> {
    this.startRequested = true;
    if (this.readyPromise) return this.readyPromise;
    if (this.initialized || Date.now() < this.retryAt) return Promise.resolve();
    const span = this.diagnostics.start('config.initialize', {provider: 'firebase'});
    let timer: ReturnType<typeof setTimeout>;
    const attempt = this.doInit(span).finally(() => {
      clearTimeout(timer);
      this.readyPromise = null;
    });
    this.readyPromise = Promise.race([
      attempt,
      new Promise<void>(resolve => {
        timer = setTimeout(() => {
          this.diagnostics.event('config.readiness', {provider: 'firebase', outcome: 'timeout'});
          resolve();
        }, CONFIG_TIMEOUT_MS);
      }),
    ]);
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

  getSupportUrl(): string {
    try {
      return getString(getRemoteConfig(), SUPPORT_URL_KEY) || SUPPORT_URL_DEFAULT;
    } catch {
      return SUPPORT_URL_DEFAULT;
    }
  }

  private async online(): Promise<boolean> {
    try {
      return await this.network?.refresh?.() ?? this.network?.isOnline() ?? true;
    } catch {
      return this.network?.isOnline() ?? true;
    }
  }

  private async doInit(span: DiagnosticSpan): Promise<void> {
    let stage = 'configure';
    try {
      const rc = getRemoteConfig();
      rc.settings = {
        ...rc.settings,
        minimumFetchIntervalMillis: __DEV__ ? 0 : 60 * 60 * 1000,
        fetchTimeoutMillis: CONFIG_TIMEOUT_MS,
      };
      rc.defaultConfig = {
        [API_BASE_URL_KEY]: DEFAULT_BASE_URL,
        [TMDB_API_KEY]: '',
        [SUPPORT_URL_KEY]: SUPPORT_URL_DEFAULT,
      };
      stage = 'fetch';
      if (!await this.online()) {
        this.retryAt = Date.now() + 30000;
        this.lastError = null;
        span.finish('unavailable', {error_code: 'offline', stage});
        return;
      }
      await fetchAndActivate(rc);
      span.finish('ok');
      this.initialized = true;
      this.lastError = null;
    } catch (error) {
      this.retryAt = Date.now() + 30000;
      if (stage === 'fetch' && !await this.online()) {
        span.finish('unavailable', {error_code: 'offline', stage});
        this.lastError = null;
      } else {
        span.fail(error, {stage});
        this.lastError = 'Unable to refresh configuration. Saved settings are still available.';
      }
    }
  }
}
