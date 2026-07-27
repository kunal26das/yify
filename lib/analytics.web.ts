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

// Crawlers, previewers and automation harnesses that execute JavaScript. They can't be blocked from
// a static host, but they shouldn't be counted as people: a single crawl of every route otherwise
// looks like a burst of real sessions and quietly distorts every metric built on top.
//
// Deliberately conservative — this only decides whether to *measure*, never whether to serve, so a
// false positive costs a missing datapoint while a false negative costs a wrong one.
const BOT_PATTERN =
    /bot|crawl|spider|slurp|headless|phantom|puppeteer|playwright|selenium|lighthouse|pagespeed|gtmetrix|pingdom|uptime|preview|scrap/i;

let botChecked = false;
let bot = false;

function isBot(): boolean {
    if (botChecked) return bot;
    botChecked = true;
    if (typeof navigator === 'undefined') return (bot = false);
    // `webdriver` is set by every mainstream automation driver and by nothing a real browser does.
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
        // Checked before queueing, not just before sending — otherwise a crawler's events would
        // sit in the queue waiting for an analytics handle that is never going to arrive.
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
