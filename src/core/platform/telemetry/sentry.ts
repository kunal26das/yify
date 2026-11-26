import * as Sentry from '@sentry/react-native';
import type {ReactNativeOptions} from '@sentry/react-native';
import {SENTRY_DSN} from '@/core/config/telemetry';
import {consentPermits, consentToken} from './consent';
import {CONSENT_REVISION, consentedMetric, sentryConsentIntegration} from './consentFilter';
import type {Attributes} from './privacy';
import {
  createEventCap,
  sanitizeBreadcrumb,
  sanitizeErrorEvent,
  sanitizeFeedbackEvent,
  sanitizeMetric,
  sanitizeSpan,
  sanitizeTransaction,
} from './privacy';

export type TelemetryPlatform = 'android' | 'web';
export interface ErrorContext {
  boundary?: string;
  tags?: Record<string, string>;
}

export const TELEMETRY_PLATFORM: TelemetryPlatform = 'android';

export function nativeSentryOptions(): ReactNativeOptions {
  const allowEvent = createEventCap();
  return {
    dsn: SENTRY_DSN,
    sendDefaultPii: false,
    sampleRate: 1,
    maxBreadcrumbs: 50,
    tracesSampler: () => (consentToken() !== undefined ? 0.1 : 0),
    tracePropagationTargets: [],
    enableLogs: false,
    enableMetrics: true,
    enableAutoSessionTracking: false,
    enableAppStartTracking: true,
    enableNativeFramesTracking: true,
    enableStallTracking: true,
    enableUserInteractionTracing: false,
    sendClientReports: false,
    integrations: [
      Sentry.breadcrumbsIntegration({console: false}),
      sentryConsentIntegration(),
      Sentry.feedbackIntegration({
        formTitle: 'Report a problem',
        submitButtonLabel: 'Send report',
        messagePlaceholder: 'What happened? Please leave out personal information.',
        showName: false,
        showEmail: false,
        isNameRequired: false,
        isEmailRequired: false,
        enableScreenshot: false,
        enableTakeScreenshot: false,
        enableShakeToReport: false,
      }),
      {
        name: 'YifyFeedbackPrivacy',
        processEvent(event, hint) {
          if (event.type === 'feedback') hint.attachments = [];
          return sanitizeFeedbackEvent(event);
        },
      },
    ],
    beforeBreadcrumb: sanitizeBreadcrumb,
    beforeSend: (event) => (allowEvent() ? sanitizeErrorEvent(event) : null),
    beforeSendTransaction: (event) => {
      const token = event.contexts?.trace?.data?.[CONSENT_REVISION];
      if (!consentPermits(token)) return null;
      const clean = sanitizeTransaction(event);
      if (clean.contexts?.trace) clean.contexts.trace.data = {...clean.contexts.trace.data, [CONSENT_REVISION]: token};
      return clean;
    },
    beforeSendSpan: (span) => {
      const token = span.data?.[CONSENT_REVISION];
      const clean = sanitizeSpan(span);
      return consentPermits(token) ? {...clean, data: {...clean.data, [CONSENT_REVISION]: token}} : clean;
    },
    beforeSendMetric: (metric) => consentedMetric(sanitizeMetric(metric)),
  };
}

function safely(work: () => void): void {
  try {
    work();
  } catch {
    return;
  }
}

if (!__DEV__) safely(() => Sentry.init(nativeSentryOptions()));

export function reportError(error: unknown, context?: ErrorContext): void {
  safely(() => {
    Sentry.captureException(error, {tags: {...context?.tags, ...(context?.boundary ? {boundary: context.boundary} : {})}});
  });
}

export function sentryCount(name: string, attributes: Attributes): void {
  safely(() => Sentry.metrics.count(name, 1, {attributes}));
}

export function sentryBreadcrumb(category: string, message: string): void {
  safely(() => Sentry.addBreadcrumb({category, message, level: 'info'}));
}

export function sentryCapture(error: unknown, tags: Record<string, string>): void {
  safely(() => {
    Sentry.captureException(error, {tags});
  });
}

export function crashNative(): void {
  Sentry.nativeCrash();
}
