import * as Sentry from '@sentry/react-native';
import {
    sanitizeBreadcrumb,
    sanitizeErrorEvent,
    sanitizeFeedbackEvent,
    sanitizeLog,
    sanitizeMetric,
    sanitizeSpan,
    sanitizeTransaction,
    shouldCaptureErrorReplay,
} from './sentry-privacy';

export function createSentryOptions({native, android = false, environment, replayEnabled = false, mirrorException}: {
    native: boolean;
    android?: boolean;
    environment: 'production' | 'preview';
    replayEnabled?: boolean;
    mirrorException?: (event: Sentry.ErrorEvent, hint: Parameters<NonNullable<Sentry.ReactNativeOptions['beforeSend']>>[1]) => void | Promise<void>;
}): Sentry.ReactNativeOptions {
    return {
        dsn: 'https://ab0c10fbe49dc5a4e4f0c9ab3c7a0386@o4512058491338752.ingest.us.sentry.io/4512058497695744',
        environment,
        sendDefaultPii: false,
        tracesSampleRate: 0.1,
        profilesSampleRate: native && !android ? 0.1 : undefined,
        tracePropagationTargets: [],
        enableLogs: true,
        logsOrigin: 'js',
        enableAutoConsoleLogs: false,
        enableMetrics: true,
        enableNativeFramesTracking: native,
        enableTombstone: native,
        enableHistoricalTombstoneReporting: false,
        ...(native && replayEnabled ? {replaysSessionSampleRate: 0, replaysOnErrorSampleRate: 0.1} : {}),
        integrations: [
            Sentry.breadcrumbsIntegration({console: false}),
            ...(native ? [Sentry.reactNativeErrorHandlersIntegration({onerror: false})] : []),
            Sentry.expoRouterIntegration({enableTimeToInitialDisplay: native, useDispatchedActionData: false}),
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
            ...(native && replayEnabled ? [Sentry.mobileReplayIntegration({
                maskAllText: true,
                maskAllImages: true,
                maskAllVectors: true,
                captureSurfaceViews: false,
                networkDetailAllowUrls: [],
                networkDetailDenyUrls: [],
                networkCaptureBodies: false,
                networkRequestHeaders: [],
                networkResponseHeaders: [],
                beforeErrorSampling: shouldCaptureErrorReplay,
            })] : []),
        ],
        beforeBreadcrumb: sanitizeBreadcrumb,
        beforeSend: async (event, hint) => {
            const clean = sanitizeErrorEvent(event);
            try { if (native) await mirrorException?.(clean, hint); } catch {}
            return clean;
        },
        beforeSendTransaction: sanitizeTransaction,
        beforeSendSpan: sanitizeSpan,
        beforeSendLog: sanitizeLog,
        beforeSendMetric: sanitizeMetric,
    };
}
