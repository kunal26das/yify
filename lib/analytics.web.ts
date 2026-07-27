import {getAnalytics, isSupported, logEvent, type Analytics} from 'firebase/analytics';

import {getFirebaseApp} from './firebase';

let analytics: Analytics | null = null;
let initStarted = false;
const queue: { name: string; params?: Record<string, string | number | boolean> }[] = [];

function isElectron(): boolean {
    return typeof navigator !== 'undefined' && navigator.userAgent.includes('Electron');
}

const BOT_PATTERN =
    /bot|crawl|spider|slurp|headless|phantom|puppeteer|playwright|selenium|lighthouse|pagespeed|gtmetrix|pingdom|uptime|preview|scrap/i;

let botChecked = false;
let bot = false;

function isBot(): boolean {
    if (botChecked) return bot;
    botChecked = true;
    if (typeof navigator === 'undefined') return (bot = false);
    bot =
        (navigator as Navigator & {webdriver?: boolean}).webdriver === true ||
        BOT_PATTERN.test(navigator.userAgent);
    return bot;
}

function init(): void {
    if (initStarted) return;
    initStarted = true;
    if (isElectron() || isBot()) return;
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
        if (isBot()) return;
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
