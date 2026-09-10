import {
  fetchAndActivate,
  getRemoteConfig,
  getString,
  type RemoteConfig,
} from 'firebase/remote-config';

import type {AppConfig, Diagnostics} from '@/domain';
import {NOOP_DIAGNOSTICS} from './NoopDiagnostics';
import {DEFAULT_BASE_URL, secureBaseUrl} from '../datasources/YtsApiDataSource';
import {getFirebaseApp} from '../datasources/firebase/FirebaseWebApp';
import {
  API_BASE_URL_KEY,
  CONFIG_TIMEOUT_MS,
  SUPPORT_URL_DEFAULT,
  SUPPORT_URL_KEY,
  TMDB_API_KEY,
  TMDB_FALLBACK_KEY,
} from '../datasources/config/remoteConfigKeys';

export class RemoteAppConfig implements AppConfig {
  constructor(private readonly diagnostics: Diagnostics = NOOP_DIAGNOSTICS) {}
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
      return secureBaseUrl(getString(this.remoteConfig, API_BASE_URL_KEY));
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

  getSupportUrl(): string {
    if (this.remoteConfig == null) return SUPPORT_URL_DEFAULT;
    try {
      return getString(this.remoteConfig, SUPPORT_URL_KEY) || SUPPORT_URL_DEFAULT;
    } catch {
      return SUPPORT_URL_DEFAULT;
    }
  }

  private async doInit(): Promise<void> {
    if (this.remoteConfig != null) return;
    const span = this.diagnostics.start('config.initialize', {provider: 'firebase'});
    try {
      const app = getFirebaseApp();
      if (app == null) {
        this.lastError = 'firebase app unavailable';
        span.finish('unavailable');
        return;
      }
      const rc = getRemoteConfig(app);
      rc.defaultConfig = {
        [API_BASE_URL_KEY]: DEFAULT_BASE_URL,
        [TMDB_API_KEY]: '',
        [SUPPORT_URL_KEY]: SUPPORT_URL_DEFAULT,
      };
      const fetched = await Promise.race([
        fetchAndActivate(rc).then(() => {
          this.remoteConfig = rc;
          return true;
        }),
        new Promise<boolean>((resolve) => {
          setTimeout(() => {
            this.lastError = this.lastError ?? 'remote config timed out';
            resolve(false);
          }, CONFIG_TIMEOUT_MS);
        }),
      ]);
      span.finish(fetched ? 'ok' : 'timeout');
    } catch (error) {
      span.fail(error);
      this.lastError = error instanceof Error ? error.message : String(error);
    }
  }
}
