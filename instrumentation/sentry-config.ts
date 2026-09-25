import * as Sentry from '@sentry/react-native';
import {
    sanitizeBreadcrumb,
    sanitizeErrorEvent,
    sanitizeFeedbackEvent,
    sanitizeLog,
    sanitizeMetric,
    sanitizeSpan,
    sanitizeTransaction,
} from './sentry-privacy';
import {optionalTelemetryConsent, type OptionalTelemetryConsent} from './optional-telemetry';
import {CONSENT_REVISION, sentryConsentIntegration} from './sentry-consent';

export function createSentryOptions({native, environment, mirrorException, consent = optionalTelemetryConsent}: {
    native: boolean;
    android?: boolean;
    environment: 'production' | 'preview';
    consent?: OptionalTelemetryConsent;
    mirrorException?: (event: Sentry.ErrorEvent, hint: Parameters<NonNullable<Sentry.ReactNativeOptions['beforeSend']>>[1]) => void | Promise<void>;
}): Sentry.ReactNativeOptions {
    return {
        dsn: 'https://ab0c10fbe49dc5a4e4f0c9ab3c7a0386@o4512058491338752.ingest.us.sentry.io/4512058497695744',
        environment,
        sendDefaultPii: false,
        tracesSampler: () => consent.token() !== undefined ? 0.1 : 0,
        tracePropagationTargets: [],
        enableLogs: true,
        logsOrigin: 'js',
        enableAutoConsoleLogs: false,
        enableMetrics: true,
        enableAutoSessionTracking: false,
        enableAutoPerformanceTracing: false,
        enableAppStartTracking: false,
        enableNativeFramesTracking: false,
        enableStallTracking: false,
        enableUserInteractionTracing: false,
        sendClientReports: false,
        enableTombstone: native,
        enableHistoricalTombstoneReporting: false,
        integrations: [
            Sentry.breadcrumbsIntegration({console: false}),
            ...(native ? [Sentry.reactNativeErrorHandlersIntegration({onerror: false})] : []),
            sentryConsentIntegration(consent),
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
        beforeSend: async (event, hint) => {
            const clean = sanitizeErrorEvent(event);
            try { if (native) await mirrorException?.(clean, hint); } catch {}
            return clean;
        },
        beforeSendTransaction: event => {
            const token = event.contexts?.trace?.data?.[CONSENT_REVISION];
            if (!consent.permits(token)) return null;
            const clean = sanitizeTransaction(event);
            if (clean.contexts?.trace) clean.contexts.trace.data = {...clean.contexts.trace.data, [CONSENT_REVISION]: token};
            return clean;
        },
        beforeSendSpan: span => {
            const token = span.data?.[CONSENT_REVISION];
            const clean = sanitizeSpan(span);
            return consent.permits(token) ? {...clean, data: {...clean.data, [CONSENT_REVISION]: token}} : clean;
        },
        beforeSendLog: log => {
            const token = consent.token();
            if (token === undefined) return null;
            const clean = sanitizeLog(log);
            return clean ? {...clean, attributes: {...clean.attributes, [CONSENT_REVISION]: token}} : null;
        },
        beforeSendMetric: metric => {
            const token = consent.token();
            if (token === undefined) return null;
            const clean = sanitizeMetric(metric);
            return clean ? {...clean, attributes: {...clean.attributes, [CONSENT_REVISION]: token}} : null;
        },
    };
}
