import {GLOBAL_MECHANISM, GROUPING_NAMESPACE} from './constants';
import {createCrashlyticsError} from './crashlytics-error';
import {installCrashlyticsHandler} from './crashlytics-handler';
import {createSentryCrashlyticsMirror} from './sentry-crashlytics';
import {createSentryGlobalErrorReporter} from './sentry-global';
import type {CrashlyticsApi, CrashlyticsClient, CrashReportingBridge, CrashReportingOptions} from './types';

export function createCrashReportingBridge<Client extends CrashlyticsClient>({
    errorUtils, loadCrashlytics, exceptionsManager, attributes = {},
    groupingNamespace = GROUPING_NAMESPACE, globalMechanism = GLOBAL_MECHANISM,
    fatalTimeoutMs = 2000, metadataTimeoutMs = 500,
}: CrashReportingOptions<Client>): CrashReportingBridge {
    if (!/^[a-zA-Z_$][a-zA-Z0-9_$]*(?:\.[a-zA-Z_$][a-zA-Z0-9_$]*)*$/.test(groupingNamespace)) {
        throw new Error('Crash grouping namespace must contain identifier segments');
    }
    if (!/^[a-zA-Z][a-zA-Z0-9_.-]{0,79}$/.test(globalMechanism)) {
        throw new Error('Crash mechanism must be a bounded identifier');
    }
    if (![fatalTimeoutMs, metadataTimeoutMs].every(value => Number.isFinite(value) && value >= 0)) {
        throw new Error('Crash reporting deadlines must be finite nonnegative numbers');
    }
    let api: CrashlyticsApi<Client> | undefined;
    let client: Client | undefined;
    let reportToSentry: ((error: unknown, isFatal: boolean) => Promise<void>) | undefined;
    const normalizeError = (error: unknown, operation?: string) => createCrashlyticsError(error, groupingNamespace, operation);

    async function setReportMetadata(metadata: Record<string, string>): Promise<void> {
        if (!api || !client?.isCrashlyticsCollectionEnabled) return;
        let timer: ReturnType<typeof setTimeout> | undefined;
        try {
            await Promise.race([
                api.setAttributes(client, {
                    sentry_event_id: '', sentry_release: '', sentry_environment: '',
                    sentry_mechanism: '', sentry_handled: '', 'diagnostics.operation': '',
                    ...metadata,
                }),
                new Promise<void>(resolve => { timer = setTimeout(resolve, metadataTimeoutMs); }),
            ]);
        } catch {}
        finally {
            if (timer !== undefined) clearTimeout(timer);
        }
    }

    const mirrorException = createSentryCrashlyticsMirror({
        normalizeError, globalMechanism,
        isEnabled: () => client?.isCrashlyticsCollectionEnabled === true,
        async recordError(error, metadata) {
            if (!api || !client?.isCrashlyticsCollectionEnabled) return;
            await setReportMetadata(metadata);
            if (client.isCrashlyticsCollectionEnabled) api.recordError(client, error);
        },
    });

    installCrashlyticsHandler(errorUtils, () => {
        api = loadCrashlytics();
        client = api.getCrashlytics();
        try {
            if (client.isCrashlyticsCollectionEnabled) {
                void Promise.resolve(api.setAttributes(client, {...attributes})).catch(() => {});
            }
        } catch {}
        return client;
    }, (instance, error) => api?.recordError(instance, error), exceptionsManager,
    (error, isFatal) => reportToSentry?.(error, isFatal), normalizeError);

    return {
        mirrorException,
        connectSentry(sentry) {
            reportToSentry = createSentryGlobalErrorReporter(sentry,
                eventId => setReportMetadata({sentry_event_id: eventId, sentry_mechanism: globalMechanism}),
                fatalTimeoutMs, globalMechanism);
        },
    };
}

export function createNoopCrashReportingBridge(): CrashReportingBridge {
    return {connectSentry() {}, async mirrorException() {}};
}
