import {SENTRY_DSN} from '@/core/config/telemetry';
import type {Attributes} from './privacy';
import type {ErrorContext, TelemetryPlatform} from './sentry';

export type {ErrorContext, TelemetryPlatform};

type BrowserSdk = typeof import('@sentry/browser');

interface PendingError {
  error: unknown;
  tags: Record<string, string>;
}

export const TELEMETRY_PLATFORM: TelemetryPlatform = 'web';
export const ERROR_BUFFER_SIZE = 10;
export const IDLE_LOAD_TIMEOUT_MS = 3000;

const pending: PendingError[] = [];
let sdk: BrowserSdk | null = null;
let loading: Promise<BrowserSdk | null> | null = null;

function remember(error: unknown, tags: Record<string, string>): void {
  if (pending.length < ERROR_BUFFER_SIZE) pending.push({error, tags});
}

function onWindowError(event: ErrorEvent): void {
  remember(event.error ?? event.message, {});
  void loadSentry();
}

function onUnhandledRejection(event: PromiseRejectionEvent): void {
  remember(event.reason, {});
  void loadSentry();
}

function detachBufferListeners(): void {
  if (typeof window === 'undefined') return;
  window.removeEventListener('error', onWindowError);
  window.removeEventListener('unhandledrejection', onUnhandledRejection);
}

async function initialize(): Promise<BrowserSdk | null> {
  if (typeof window === 'undefined') return null;
  const [browser, privacy, filter] = await Promise.all([import('@sentry/browser'), import('./privacy'), import('./consentFilter')]);
  const allowEvent = privacy.createEventCap();
  browser.init({
    dsn: SENTRY_DSN,
    environment: privacy.webEnvironment(window.location.hostname),
    sendDefaultPii: false,
    defaultIntegrations: false,
    integrations: [
      browser.breadcrumbsIntegration({console: false, dom: false}),
      browser.globalHandlersIntegration(),
      browser.linkedErrorsIntegration(),
      browser.dedupeIntegration(),
      browser.httpContextIntegration(),
      browser.eventFiltersIntegration(),
      filter.sentryConsentIntegration(),
    ],
    tracesSampleRate: 0,
    enableMetrics: true,
    sendClientReports: false,
    maxBreadcrumbs: 50,
    denyUrls: [/^chrome-extension:/, /^moz-extension:/, /^safari(-web)?-extension:/],
    beforeBreadcrumb: privacy.sanitizeBreadcrumb,
    beforeSend: (event, hint) => {
      if (privacy.isBrowserExtensionError(hint.originalException)) return null;
      return allowEvent() ? privacy.sanitizeErrorEvent(event) : null;
    },
    beforeSendMetric: (metric) => filter.consentedMetric(privacy.sanitizeMetric(metric)),
  });
  sdk = browser;
  detachBufferListeners();
  for (const {error, tags} of pending.splice(0)) browser.captureException(error, {tags});
  return browser;
}

export function loadSentry(): Promise<BrowserSdk | null> {
  loading ??= initialize().catch(() => null);
  return loading;
}

if (!__DEV__ && typeof window !== 'undefined') {
  window.addEventListener('error', onWindowError);
  window.addEventListener('unhandledrejection', onUnhandledRejection);
  if (typeof window.requestIdleCallback === 'function') {
    window.requestIdleCallback(() => void loadSentry(), {timeout: IDLE_LOAD_TIMEOUT_MS});
  } else {
    setTimeout(() => void loadSentry(), IDLE_LOAD_TIMEOUT_MS);
  }
}

function errorTags(context?: ErrorContext): Record<string, string> {
  return {...context?.tags, ...(context?.boundary ? {boundary: context.boundary} : {})};
}

export function reportError(error: unknown, context?: ErrorContext): void {
  sentryCapture(error, errorTags(context));
}

export function sentryCount(name: string, attributes: Attributes): void {
  try {
    sdk?.metrics.count(name, 1, {attributes});
  } catch {
    return;
  }
}

export function sentryBreadcrumb(category: string, message: string): void {
  try {
    sdk?.addBreadcrumb({category, message, level: 'info'});
  } catch {
    return;
  }
}

export function sentryCapture(error: unknown, tags: Record<string, string>): void {
  if (__DEV__) return;
  if (sdk === null) {
    remember(error, tags);
    void loadSentry();
    return;
  }
  try {
    sdk.captureException(error, {tags});
  } catch {
    return;
  }
}

export function crashNative(): void {
  return;
}
