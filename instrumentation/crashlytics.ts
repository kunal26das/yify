import * as Updates from 'expo-updates';
import {
    createCrashReportingBridge, createNoopCrashReportingBridge,
    type ExceptionsManagerLike, type SentryReporter,
} from '../modules/react-native-crash-reporting';

const bridge = __DEV__ ? createNoopCrashReportingBridge() : createCrashReportingBridge({
    errorUtils: ErrorUtils,
    loadCrashlytics: () => require('@react-native-firebase/crashlytics') as typeof import('@react-native-firebase/crashlytics'),
    exceptionsManager: (require('react-native/Libraries/Core/ExceptionsManager') as {
        default: ExceptionsManagerLike;
    }).default,
    groupingNamespace: 'YifyReactNative',
    globalMechanism: 'yify.react_native.global',
    attributes: {
        react_native_runtime: Updates.runtimeVersion || 'unknown',
        expo_update_id: Updates.updateId || 'embedded',
        expo_update_channel: Updates.channel || 'unknown',
    },
});

export const mirrorSentryException = bridge.mirrorException;

export function connectCrashReportingSentry(sentry: SentryReporter): void {
    bridge.connectSentry(sentry);
}
