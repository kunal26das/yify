import {Platform} from 'react-native';
import mobileAds, {
    AdEventType,
    AdsConsent,
    AdsConsentPrivacyOptionsRequirementStatus,
    InterstitialAd,
    MaxAdContentRating,
    type PaidEvent,
    RevenuePrecisions,
    TestIds,
} from 'react-native-google-mobile-ads';

import {
    type AdGateway,
    type AdRevenuePrecision,
    type AdRevenueSink,
    type AdTrigger,
    type AnalyticsSink,
    decideAd,
    type PurchaseState,
} from '@/domain';
import {isForeground, watchForeground} from '../datasources/platform/ForegroundWatcher';

const AD_UNIT_ID = 'ca-app-pub-2292299294214510/8726265265';
const AD_SHOW_TIMEOUT_MS = 8000;
const LOAD_BACKOFF_MS = [30000, 60000, 120000];
const AD_FORMAT = 'interstitial';
const AD_PLATFORM = 'admob';
const FALLBACK_CURRENCY = 'USD';

const PRECISION: Record<number, AdRevenuePrecision> = {
    [RevenuePrecisions.UNKNOWN]: 'unknown',
    [RevenuePrecisions.ESTIMATED]: 'estimated',
    [RevenuePrecisions.PUBLISHER_PROVIDED]: 'publisher_defined',
    [RevenuePrecisions.PRECISE]: 'exact',
};

export interface AdMobAdGatewayOptions {
    analytics: AnalyticsSink;
    adRevenue: AdRevenueSink;
    entitlement: () => PurchaseState;
}

export class AdMobAdGateway implements AdGateway {
    readonly supported = Platform.OS === 'android';

    private readonly options: AdMobAdGatewayOptions;

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
    private requestSeq = 0;
    private privacyRequired = false;
    private canRequestAds = true;

    constructor(options: AdMobAdGatewayOptions) {
        this.options = options;
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
        const decision = decideAd({
            trigger,
            entitlementKnown: entitlement.ready,
            adsRemoved: entitlement.adsRemoved,
            loaded: this.loaded && !this.showing && this.interstitial != null,
        });
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
        return __DEV__ ? TestIds.INTERSTITIAL : AD_UNIT_ID;
    }

    private requestNext(): void {
        if (!this.initialized || !this.canRequestAds) return;
        if (this.loading || this.loaded || this.showing) return;
        const unitId = this.resolveUnitId();
        this.clearRetry();
        this.teardownAd();
        this.loading = true;
        this.requestSeq += 1;
        const impressionId = `${unitId}:${Date.now()}:${this.requestSeq}`;
        const ad = InterstitialAd.createForAdRequest(unitId);
        this.interstitial = ad;
        let offPaid: (() => void) | null = null;
        offPaid = ad.addAdEventListener(AdEventType.PAID, (payload) => {
            offPaid?.();
            offPaid = null;
            this.reportRevenue(payload as unknown as PaidEvent, unitId, impressionId);
        });
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

    private reportRevenue(paid: PaidEvent | undefined, adUnitId: string, impressionId: string): void {
        const raw = paid?.value;
        const value = typeof raw === 'number' && Number.isFinite(raw) && raw >= 0 ? raw : 0;
        const currency = paid?.currency || FALLBACK_CURRENCY;
        const precision = PRECISION[paid?.precision as number] ?? 'unknown';
        this.options.analytics.trackEvent('ad_impression', {
            ad_platform: AD_PLATFORM,
            ad_format: AD_FORMAT,
            ad_unit_name: adUnitId,
            currency,
            value,
            precision,
        });
        this.options.adRevenue.trackImpression({
            adUnitId,
            impressionId,
            value,
            currency,
            precision,
        });
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
}
