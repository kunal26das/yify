import type {Analytics} from 'firebase/analytics';
import {getFirebaseMeasurementId, loadFirebaseApp} from '@/core/platform/firebase/webApp';

export type AnalyticsParams = Record<string, string | number>;

type AnalyticsSdk = typeof import('firebase/analytics');

const BOT_PATTERN = /bot|crawl|spider|slurp|headless|phantom|puppeteer|playwright|selenium|lighthouse|pagespeed|gtmetrix|pingdom|uptime|preview|scrap/i;

let sdk: AnalyticsSdk | null = null;
let analytics: Analytics | null = null;
let enabled = false;
let revision = 0;

function pageContext(): {page_location: string; page_referrer: string} {
  if (typeof window === 'undefined') return {page_location: '', page_referrer: ''};
  return {page_location: `${window.location.origin}${window.location.pathname}`, page_referrer: ''};
}

function setCollectionDisabled(disabled: boolean): void {
  if (typeof window === 'undefined') return;
  const ids = new Set([getFirebaseMeasurementId(), analytics?.app.options.measurementId]);
  for (const id of ids) {
    if (id) Reflect.set(window, `ga-disable-${id}`, disabled);
  }
}

function clearCookies(): void {
  if (typeof document === 'undefined' || typeof window === 'undefined') return;
  try {
    const measurementId = analytics?.app.options.measurementId ?? getFirebaseMeasurementId();
    const names = ['_ga', '_gid', '_gat', ...(measurementId ? [`_ga_${measurementId.replace(/^G-/, '')}`] : [])];
    const domains = ['', `; domain=${window.location.hostname}`, `; domain=.${window.location.hostname}`];
    for (const name of names) {
      for (const domain of domains) document.cookie = `${name}=; Max-Age=0; path=/; SameSite=Lax${domain}`;
    }
  } catch {
    return;
  }
}

function automated(): boolean {
  if (typeof navigator === 'undefined' || typeof window === 'undefined') return true;
  return Reflect.get(navigator, 'webdriver') === true || BOT_PATTERN.test(navigator.userAgent);
}

async function apply(allowed: boolean): Promise<void> {
  const current = ++revision;
  enabled = false;
  setCollectionDisabled(true);
  if (!allowed) {
    if (sdk && analytics) sdk.setConsent({analytics_storage: 'denied', ad_storage: 'denied', ad_user_data: 'denied', ad_personalization: 'denied'});
    clearCookies();
    return;
  }
  if (automated()) return;
  const app = await loadFirebaseApp();
  if (app === null || current !== revision) return;
  const loaded = await import('firebase/analytics');
  if (!(await loaded.isSupported()) || current !== revision) return;
  sdk = loaded;
  loaded.setConsent({analytics_storage: 'granted', ad_storage: 'denied', ad_user_data: 'denied', ad_personalization: 'denied'});
  analytics ??= loaded.initializeAnalytics(app, {
    config: {send_page_view: false, allow_google_signals: false, allow_ad_personalization_signals: false, ...pageContext()},
  });
  setCollectionDisabled(false);
  enabled = current === revision;
}

export function applyAnalyticsConsent(allowed: boolean): void {
  apply(allowed).catch(() => {
    enabled = false;
  });
}

export function analyticsEnabled(): boolean {
  return enabled;
}

export function logAnalyticsEvent(name: string, params: AnalyticsParams): void {
  if (!enabled || sdk === null || analytics === null) return;
  try {
    sdk.logEvent(analytics, name, {...params, ...pageContext()});
  } catch {
    return;
  }
}

export function logAnalyticsScreen(screen: string): void {
  logAnalyticsEvent('screen_view', {screen_name: screen, screen_class: screen});
}

export function setAnalyticsUserProperties(properties: Record<string, string>): void {
  if (!enabled || sdk === null || analytics === null) return;
  try {
    sdk.setUserProperties(analytics, properties);
  } catch {
    return;
  }
}

export async function analyticsInstanceId(): Promise<string | null> {
  return null;
}
