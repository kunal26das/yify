import * as Sentry from '@sentry/react-native';
import * as Updates from 'expo-updates';
import {Platform} from 'react-native';
import {createSentryOptions} from './sentry-config';
import {connectCrashReportingSentry, mirrorSentryException} from './crashlytics';
import {sentryEnvironment} from './sentry-environment';

if (!__DEV__ && (Platform.OS !== 'web' || typeof window !== 'undefined')) {
    const native = Platform.OS === 'android' || Platform.OS === 'ios';
    Sentry.init(createSentryOptions({
        native,
        mirrorException: native ? mirrorSentryException : undefined,
        environment: sentryEnvironment({
            native,
            channel: Updates.channel,
            configured: process.env.EXPO_PUBLIC_SENTRY_ENVIRONMENT,
            hostname: Platform.OS === 'web' ? window.location?.hostname : undefined,
        }),
    }));
    if (native) connectCrashReportingSentry(Sentry);
}
