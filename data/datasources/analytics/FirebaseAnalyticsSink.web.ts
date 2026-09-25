import {
    initializeAnalytics,
    isSupported,
    logEvent,
    setConsent,
    setUserProperties,
    type Analytics,
} from 'firebase/analytics';

import type {AnalyticsParams, AnalyticsSink, PrivacyPreferences} from '@/domain';
import {getFirebaseApp, getFirebaseMeasurementId} from '../firebase/FirebaseWebApp';
import {optionalAnalyticsAllowed} from '../../services/optionalAnalytics';

const BOT_PATTERN =
    /bot|crawl|spider|slurp|headless|phantom|puppeteer|playwright|selenium|lighthouse|pagespeed|gtmetrix|pingdom|uptime|preview|scrap/i;

export class FirebaseAnalyticsSink implements AnalyticsSink {
    private analytics: Analytics | null = null;
    private enabled = false;
    private revision = 0;

    constructor(private readonly privacy: PrivacyPreferences) {
        privacy.subscribe(() => { void this.applyChoices(); });
        void this.applyChoices();
    }

    trackEvent(name: string, params?: AnalyticsParams): void {
        if (!this.allowed() || !this.analytics) return;
        try { logEvent(this.analytics, name, {...params, ...this.pageContext()}); } catch {}
    }

    trackScreenView(screenName: string): void {
        this.trackEvent('screen_view', {screen_name: screenName, screen_class: screenName});
    }

    setUserProperty(name: string, value: string | null): void {
        if (!this.allowed() || !this.analytics) return;
        try { setUserProperties(this.analytics, {[name]: value}); } catch {}
    }

    private allowed(): boolean {
        return this.enabled && optionalAnalyticsAllowed(this.privacy);
    }

    private async applyChoices(): Promise<void> {
        const revision = ++this.revision;
        this.enabled = false;
        const allowed = optionalAnalyticsAllowed(this.privacy);
        try {
            this.setCollectionDisabled(true);
            if (!allowed) {
                if (this.analytics) {
                    setConsent({analytics_storage: 'denied', ad_storage: 'denied',
                        ad_user_data: 'denied', ad_personalization: 'denied'});
                }
                this.clearCookies();
                return;
            }
            if (typeof navigator === 'undefined' || typeof window === 'undefined' ||
                (navigator as Navigator & {webdriver?: boolean}).webdriver === true ||
                BOT_PATTERN.test(navigator.userAgent) || /Electron/i.test(navigator.userAgent)) return;
            const supported = await isSupported();
            if (!supported || revision !== this.revision || !optionalAnalyticsAllowed(this.privacy)) return;
            const app = getFirebaseApp();
            if (!app) return;
            setConsent({analytics_storage: 'granted', ad_storage: 'denied',
                ad_user_data: 'denied', ad_personalization: 'denied'});
            this.analytics ??= initializeAnalytics(app, {config: {send_page_view: false,
                allow_google_signals: false, allow_ad_personalization_signals: false, ...this.pageContext()}});
            this.setCollectionDisabled(false);
            this.enabled = true;
        } catch {
            this.enabled = false;
        }
    }

    private setCollectionDisabled(disabled: boolean): void {
        if (typeof window === 'undefined') return;
        const measurementIds = new Set([getFirebaseMeasurementId(), this.analytics?.app.options.measurementId]);
        for (const measurementId of measurementIds) {
            if (measurementId) (window as unknown as Record<string, unknown>)[`ga-disable-${measurementId}`] = disabled;
        }
    }

    private pageContext(): {page_location: string; page_referrer: string} {
        return {page_location: typeof window === 'undefined' ? '' : `${window.location.origin}${window.location.pathname}`,
            page_referrer: ''};
    }

    private clearCookies(): void {
        if (typeof document === 'undefined') return;
        try {
            const measurementId = this.analytics?.app.options.measurementId ?? getFirebaseMeasurementId();
            const names = ['_ga', '_gid', '_gat', ...(measurementId ? [`_ga_${measurementId.replace(/^G-/, '')}`] : [])];
            const domains = typeof window === 'undefined' ? [] : [window.location.hostname, `.${window.location.hostname}`];
            for (const name of names) {
                for (const domain of ['', ...domains.map(value => `; domain=${value}`)]) {
                    document.cookie = `${name}=; Max-Age=0; path=/; SameSite=Lax${domain}`;
                }
            }
        } catch {}
    }
}

export async function getAnalyticsInstanceId(_privacy?: PrivacyPreferences): Promise<string | null> {
    return null;
}
