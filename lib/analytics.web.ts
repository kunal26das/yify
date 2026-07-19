import {getAnalytics, isSupported, logEvent, type Analytics} from 'firebase/analytics';

import {getFirebaseApp} from './firebase';

let analytics: Analytics | null = null;
let initStarted = false;
const queue: { name: string; params?: Record<string, string | number | boolean> }[] = [];

// The desktop app is the same web bundle running in Electron — keep its
// traffic out of web analytics.
function isElectron(): boolean {
    return typeof navigator !== 'undefined' && navigator.userAgent.includes('Electron');
}

function init(): void {
    if (initStarted) return;
    initStarted = true;
    if (isElectron()) return;
    void isSupported()
        .then((supported) => {
            const app = getFirebaseApp();
            if (!supported || app == null) return;
            analytics = getAnalytics(app);
            queue.splice(0).forEach(({name, params}) => logEvent(analytics!, name, params));
        })
        .catch(() => {
        });
}

export function trackEvent(name: string, params?: Record<string, string | number | boolean>): void {
    try {
        init();
        if (analytics) {
            logEvent(analytics, name, params);
        } else if (queue.length < 50) {
            queue.push({name, params});
        }
    } catch {
    }
}

export function trackScreenView(screenName: string): void {
    trackEvent('screen_view', {screen_name: screenName, screen_class: screenName});
}
