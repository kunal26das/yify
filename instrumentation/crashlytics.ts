import type {Crashlytics} from '@react-native-firebase/crashlytics';
import type {ErrorEvent, ReactNativeOptions} from '@sentry/react-native';
import * as Updates from 'expo-updates';
import {ExceptionsManagerLike, installCrashlyticsHandler} from './crashlytics-handler';
import {createSentryCrashlyticsMirror} from './sentry-crashlytics';

type EventHint = Parameters<NonNullable<ReactNativeOptions['beforeSend']>>[1];

let globalReporter: ((error: unknown, isFatal: boolean) => void | Promise<void>) | undefined;
let crashlytics: Crashlytics | undefined;

export function setCrashlyticsSentryReporter(reporter: typeof globalReporter): void {
    globalReporter = reporter;
}

export async function correlateSentryCrash(eventId: string): Promise<void> {
    if (!crashlytics?.isCrashlyticsCollectionEnabled) return;
    await setReportMetadata({sentry_event_id: eventId, sentry_mechanism: 'yify.react_native.global'});
}

async function setReportMetadata(metadata: Record<string, string>): Promise<void> {
    if (!crashlytics?.isCrashlyticsCollectionEnabled) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
        await Promise.race([
            firebaseApi().setAttributes(crashlytics, {
                sentry_event_id: '', sentry_release: '', sentry_environment: '',
                sentry_mechanism: '', sentry_handled: '', 'diagnostics.operation': '',
                ...metadata,
            }),
            new Promise<void>(resolve => { timer = setTimeout(resolve, 500); }),
        ]);
    } catch {}
    finally {
        if (timer !== undefined) clearTimeout(timer);
    }
}

const mirror = createSentryCrashlyticsMirror({
    isEnabled: () => crashlytics?.isCrashlyticsCollectionEnabled === true,
    async recordError(error, metadata) {
        if (!crashlytics?.isCrashlyticsCollectionEnabled) return;
        const firebase = firebaseApi();
        await setReportMetadata(metadata);
        if (crashlytics.isCrashlyticsCollectionEnabled) firebase.recordError(crashlytics, error);
    },
});

export function mirrorSentryException(event: ErrorEvent, hint: EventHint): Promise<void> {
    return mirror(event, hint);
}

function firebaseApi(): typeof import('@react-native-firebase/crashlytics') {
    return require('@react-native-firebase/crashlytics');
}

if (!__DEV__) {
    const {default: exceptionsManager} = require('react-native/Libraries/Core/ExceptionsManager') as {
        default: ExceptionsManagerLike;
    };
    installCrashlyticsHandler<Crashlytics>(ErrorUtils, () => {
        const firebase = firebaseApi();
        const client = firebase.getCrashlytics();
        crashlytics = client;
        try {
            void firebase.setAttributes(client, {
                react_native_runtime: Updates.runtimeVersion || 'unknown',
                expo_update_id: Updates.updateId || 'embedded',
                expo_update_channel: Updates.channel || 'unknown',
            }).catch(() => {});
        } catch {}
        return client;
    }, (client, error) => firebaseApi().recordError(client, error), exceptionsManager,
    (error, isFatal) => globalReporter?.(error, isFatal));
}
