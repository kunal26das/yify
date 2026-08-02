import {
    getAnalytics,
    isSupported,
    logEvent,
    setUserProperties,
    type Analytics,
} from 'firebase/analytics';

import type {AnalyticsParams, AnalyticsSink} from '@/domain';
import {getFirebaseApp} from '../firebase/FirebaseWebApp';

const BOT_PATTERN =
    /bot|crawl|spider|slurp|headless|phantom|puppeteer|playwright|selenium|lighthouse|pagespeed|gtmetrix|pingdom|uptime|preview|scrap/i;

function isElectron(): boolean {
    return typeof navigator !== 'undefined' && navigator.userAgent.includes('Electron');
}

export class FirebaseAnalyticsSink implements AnalyticsSink {
    private analytics: Analytics | null = null;
    private initStarted = false;
    private botChecked = false;
    private bot = false;
    private readonly queue: {name: string; params?: AnalyticsParams}[] = [];
    private readonly propertyQueue: Record<string, string | null> = {};

    trackEvent(name: string, params?: AnalyticsParams): void {
        try {
            if (this.isBot()) return;
            this.init();
            if (this.analytics) {
                logEvent(this.analytics, name, params);
            } else if (this.queue.length < 50) {
                this.queue.push({name, params});
            }
        } catch {
        }
    }

    trackScreenView(screenName: string): void {
        this.trackEvent('screen_view', {screen_name: screenName, screen_class: screenName});
    }

    setUserProperty(name: string, value: string | null): void {
        try {
            if (this.isBot()) return;
            this.init();
            if (this.analytics) {
                setUserProperties(this.analytics, {[name]: value});
            } else {
                this.propertyQueue[name] = value;
            }
        } catch {
        }
    }

    private isBot(): boolean {
        if (this.botChecked) return this.bot;
        this.botChecked = true;
        if (typeof navigator === 'undefined') return (this.bot = false);
        this.bot =
            (navigator as Navigator & {webdriver?: boolean}).webdriver === true ||
            BOT_PATTERN.test(navigator.userAgent);
        return this.bot;
    }

    private init(): void {
        if (this.initStarted) return;
        this.initStarted = true;
        if (isElectron() || this.isBot()) return;
        void isSupported()
            .then((supported) => {
                const app = getFirebaseApp();
                if (!supported || app == null) return;
                this.analytics = getAnalytics(app);
                this.queue.splice(0).forEach(({name, params}) => {
                    logEvent(this.analytics!, name, params);
                });
                const properties = Object.entries(this.propertyQueue);
                if (properties.length > 0) {
                    properties.forEach(([key]) => delete this.propertyQueue[key]);
                    setUserProperties(this.analytics, Object.fromEntries(properties));
                }
            })
            .catch(() => {
            });
    }
}

export async function getAnalyticsInstanceId(): Promise<string | null> {
    return null;
}
