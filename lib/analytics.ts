import {
    getAnalytics,
    getAppInstanceId,
    logEvent,
    logScreenView,
    setUserProperty as setFirebaseUserProperty,
} from '@react-native-firebase/analytics';
import {getCrashlytics, log} from '@react-native-firebase/crashlytics';

function breadcrumb(name: string, params?: Record<string, string | number | boolean>): void {
    try {
        log(getCrashlytics(), params ? `${name} ${JSON.stringify(params)}` : name);
    } catch {
    }
}

export function trackEvent(name: string, params?: Record<string, string | number | boolean>): void {
    try {
        void logEvent(getAnalytics(), name, params);
    } catch {
    }
    breadcrumb(name, params);
}

export function trackScreenView(screenName: string): void {
    try {
        void logScreenView(getAnalytics(), {screen_name: screenName, screen_class: screenName});
    } catch {
    }
    breadcrumb('screen_view', {screen_name: screenName});
}

export function setUserProperty(name: string, value: string | null): void {
    try {
        void setFirebaseUserProperty(getAnalytics(), name, value);
    } catch {
    }
}

export async function getAnalyticsInstanceId(): Promise<string | null> {
    try {
        return await getAppInstanceId(getAnalytics());
    } catch {
        return null;
    }
}
