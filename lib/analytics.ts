import {getAnalytics, logEvent, logScreenView} from '@react-native-firebase/analytics';
import {getCrashlytics, log} from '@react-native-firebase/crashlytics';

// Every event also leaves a Crashlytics breadcrumb, so crash reports show
// what the user was doing right before the crash.
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
