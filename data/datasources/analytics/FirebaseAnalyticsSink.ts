import {
    getAnalytics,
    getAppInstanceId,
    logEvent,
    logScreenView,
    setUserProperty as setFirebaseUserProperty,
} from '@react-native-firebase/analytics';
import {getCrashlytics, log} from '@react-native-firebase/crashlytics';

import type {AnalyticsParams, AnalyticsSink} from '@/domain';

function breadcrumb(name: string, params?: AnalyticsParams): void {
    try {
        log(getCrashlytics(), params ? `${name} ${JSON.stringify(params)}` : name);
    } catch {
    }
}

export class FirebaseAnalyticsSink implements AnalyticsSink {
    trackEvent(name: string, params?: AnalyticsParams): void {
        try {
            void logEvent(getAnalytics(), name, params);
        } catch {
        }
        breadcrumb(name, params);
    }

    trackScreenView(screenName: string): void {
        try {
            void logScreenView(getAnalytics(), {screen_name: screenName, screen_class: screenName});
        } catch {
        }
        breadcrumb('screen_view', {screen_name: screenName});
    }

    setUserProperty(name: string, value: string | null): void {
        try {
            void setFirebaseUserProperty(getAnalytics(), name, value);
        } catch {
        }
    }
}

export async function getAnalyticsInstanceId(): Promise<string | null> {
    try {
        return await getAppInstanceId(getAnalytics());
    } catch {
        return null;
    }
}
