import {Platform} from 'react-native';
import mobileAds, {
    AdEventType,
    AdsConsent,
    AdsConsentPrivacyOptionsRequirementStatus,
    InterstitialAd,
    MaxAdContentRating,
    TestIds,
} from 'react-native-google-mobile-ads';

import {
    AD_WINDOW_MS,
    commitAdShown,
    decideAd,
    encodeAdGateState,
    parseAdGateState,
    type AdGateState,
    type AdGateway,
    type AdTrigger,
    type AnalyticsSink,
    type KeyValueStore,
    type PurchaseState,
} from '@/domain';
import {isForeground, watchForeground} from '../datasources/platform/ForegroundWatcher';

const AD_STATE_KEY = 'gate';
const AD_SHOW_TIMEOUT_MS = 8000;
const LOAD_BACKOFF_MS = [30000, 60000, 120000];
const LOAD_BUDGET = 12;
const LOAD_BUDGET_WINDOW_MS = 60 * 60 * 1000;

export interface AdMobAdGatewayOptions {
    analytics: AnalyticsSink;
    store: KeyValueStore;
    ready: () => Promise<void>;
    enabled: () => boolean;
    unitId: () => string;
    cooldownMs: () => number;
    dailyCap: () => number;
    entitlement: () => PurchaseState;
}

export class AdMobAdGateway implements AdGateway {
    readonly supported = Platform.OS === 'android';

    private readonly options: AdMobAdGatewayOptions;

    private state: AdGateState;
    private readyPromise: Promise<void> | null = null;
    private interstitial: InterstitialAd | null = null;
    private unsubscribeAd: (() => void) | null = null;
    private retryTimer: ReturnType<typeof setTimeout> | null = null;
    private pending: Promise<boolean> | null = null;
    private initialized = false;
    private loaded = false;
    private loading = false;
    private showing = false;
    private failures = 0;
    private loads = 0;
    private loadWindowStartedAt = 0;
    private privacyRequired = false;
    private canRequestAds = true;
    private testUnitReported = false;

    constructor(options: AdMobAdGatewayOptions) {
        this.options = options;
        this.state = parseAdGateState(options.store.getString(AD_STATE_KEY));
    }

    init(): Promise<void> {
        if (!this.supported) return Promise.resolve();
        this.readyPromise = this.readyPromise ?? this.doInit();
        return this.readyPromise;
    }

    show(trigger: AdTrigger): Promise<boolean> | null {
        if (!this.supported) return null;
        if (this.showing) return this.pending;
        const entitlement = this.options.entitlement();
        const decision = decideAd(
            {
                trigger,
                enabled: this.options.enabled() && entitlement.available,
                entitlementKnown: entitlement.ready,
                adsRemoved: entitlement.adsRemoved,
                loaded: this.loaded && !this.showing && this.interstitial != null,
                state: this.state,
            },
            Date.now(),
            this.options.cooldownMs(),
            AD_WINDOW_MS,
            this.options.dailyCap()
        );
        if (decision !== 'show') {
            this.options.analytics.trackEvent('trailer_ad_gated', {trigger, reason: decision});
            if (decision === 'unfilled') {
                void this.init();
                if (this.retryTimer == null) this.requestNext();
            }
            return null;
        }
        const ad = this.interstitial;
        if (ad == null) return null;
        this.showing = true;
        this.loaded = false;
        this.unsubscribeAd?.();
        this.unsubscribeAd = null;
        this.pending = this.present(ad, trigger);
        return this.pending;
    }

    privacyOptionsRequired(): boolean {
        return this.privacyRequired;
    }

    async showPrivacyOptions(): Promise<void> {
        if (!this.supported) return;
        try {
            await AdsConsent.showPrivacyOptionsForm();
        } catch {
        }
    }

    private async doInit(): Promise<void> {
        try {
            await this.options.ready();
            if (!this.options.enabled() || !this.resolveUnitId()) {
                this.readyPromise = null;
                return;
            }
            await this.gatherConsent();
            if (!this.canRequestAds) {
                this.readyPromise = null;
                this.options.analytics.trackEvent('trailer_ad_failed', {reason: 'consent'});
                return;
            }
            await mobileAds().setRequestConfiguration({
                maxAdContentRating: MaxAdContentRating.T,
            });
            await mobileAds().initialize();
            this.initialized = true;
            this.requestNext();
        } catch {
            this.readyPromise = null;
            this.options.analytics.trackEvent('trailer_ad_failed', {reason: 'init'});
        }
    }

    private async gatherConsent(): Promise<void> {
        try {
            const info = await AdsConsent.gatherConsent();
            this.canRequestAds = info.canRequestAds;
            this.privacyRequired =
                info.privacyOptionsRequirementStatus ===
                AdsConsentPrivacyOptionsRequirementStatus.REQUIRED;
        } catch {
            this.options.analytics.trackEvent('trailer_ad_failed', {reason: 'consent_error'});
        }
    }

    private resolveUnitId(): string {
        if (__DEV__) return TestIds.INTERSTITIAL;
        const configured = this.options.unitId();
        if (configured) return configured;
        if (!this.testUnitReported) {
            this.testUnitReported = true;
            this.options.analytics.trackEvent('trailer_ad_missing_unit');
        }
        return '';
    }

    private requestNext(): void {
        if (!this.initialized || !this.canRequestAds) return;
        if (this.loading || this.loaded || this.showing) return;
        if (!this.hasLoadBudget()) return;
        const unitId = this.resolveUnitId();
        if (!unitId) return;
        this.clearRetry();
        this.teardownAd();
        this.loading = true;
        this.loads += 1;
        const ad = InterstitialAd.createForAdRequest(unitId);
        this.interstitial = ad;
        const offLoaded = ad.addAdEventListener(AdEventType.LOADED, () => {
            this.loading = false;
            this.loaded = true;
            this.failures = 0;
        });
        const offError = ad.addAdEventListener(AdEventType.ERROR, () => {
            this.loading = false;
            this.loaded = false;
            this.failures += 1;
            this.options.analytics.trackEvent('trailer_ad_failed', {reason: 'load'});
            this.scheduleRetry();
        });
        this.unsubscribeAd = () => {
            offLoaded();
            offError();
        };
        ad.load();
    }

    private present(ad: InterstitialAd, trigger: AdTrigger): Promise<boolean> {
        return new Promise<boolean>((resolve) => {
            let settled = false;
            let opened = false;
            let timer: ReturnType<typeof setTimeout> | null = null;
            let offForeground: (() => void) | null = null;

            const settle = () => {
                if (settled) return;
                settled = true;
                if (timer != null) clearTimeout(timer);
                offForeground?.();
                offForeground = null;
                offOpened();
                offClosed();
                offShowError();
                this.showing = false;
                this.pending = null;
                this.requestNext();
                resolve(opened);
            };

            const arm = () => {
                timer = setTimeout(() => {
                    timer = null;
                    if (isForeground()) {
                        this.options.analytics.trackEvent('trailer_ad_failed', {reason: 'timeout'});
                        settle();
                        return;
                    }
                    offForeground = watchForeground(() => {
                        offForeground?.();
                        offForeground = null;
                        arm();
                    });
                }, AD_SHOW_TIMEOUT_MS);
            };

            const offOpened = ad.addAdEventListener(AdEventType.OPENED, () => {
                opened = true;
                this.writeState(commitAdShown(this.state, Date.now()));
                this.options.analytics.trackEvent('trailer_ad_shown', {trigger});
            });
            const offClosed = ad.addAdEventListener(AdEventType.CLOSED, settle);
            const offShowError = ad.addAdEventListener(AdEventType.ERROR, () => {
                this.options.analytics.trackEvent('trailer_ad_failed', {reason: 'show'});
                settle();
            });

            arm();

            void ad.show().catch(() => {
                this.options.analytics.trackEvent('trailer_ad_failed', {reason: 'show'});
                settle();
            });
        });
    }

    private hasLoadBudget(): boolean {
        const now = Date.now();
        if (now - this.loadWindowStartedAt >= LOAD_BUDGET_WINDOW_MS) {
            this.loadWindowStartedAt = now;
            this.loads = 0;
        }
        if (this.loads < LOAD_BUDGET) return true;
        this.options.analytics.trackEvent('trailer_ad_failed', {reason: 'budget'});
        return false;
    }

    private scheduleRetry(): void {
        this.clearRetry();
        const index = Math.min(Math.max(this.failures - 1, 0), LOAD_BACKOFF_MS.length - 1);
        this.retryTimer = setTimeout(() => {
            this.retryTimer = null;
            this.requestNext();
        }, LOAD_BACKOFF_MS[index]);
    }

    private clearRetry(): void {
        if (this.retryTimer == null) return;
        clearTimeout(this.retryTimer);
        this.retryTimer = null;
    }

    private teardownAd(): void {
        this.unsubscribeAd?.();
        this.unsubscribeAd = null;
        this.interstitial = null;
    }

    private writeState(next: AdGateState): void {
        this.state = next;
        try {
            this.options.store.set(AD_STATE_KEY, encodeAdGateState(next));
        } catch {
        }
    }
}
