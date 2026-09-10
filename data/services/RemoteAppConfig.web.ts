import type {AppConfig, Diagnostics} from '@/domain';
import {webCatalogBaseUrl} from '../datasources/WebCatalogClient';
import {SUPPORT_URL_DEFAULT, TMDB_FALLBACK_KEY} from '../datasources/config/remoteConfigKeys';
import {NOOP_DIAGNOSTICS} from './NoopDiagnostics';

export class RemoteAppConfig implements AppConfig {
  constructor(private readonly diagnostics: Diagnostics = NOOP_DIAGNOSTICS) {}

  async init(): Promise<void> {}

  ready(): Promise<void> {
    return this.init();
  }

  error(): string | null {
    return null;
  }

  getApiBaseUrl(): string {
    return webCatalogBaseUrl();
  }

  getTmdbApiKey(): string {
    return TMDB_FALLBACK_KEY;
  }

  getSupportUrl(): string {
    return SUPPORT_URL_DEFAULT;
  }
}
