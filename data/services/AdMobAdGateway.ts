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
    type AdImpression,
    type AdRevenuePrecision,
    type AdRevenueSink,
    type AdTrigger,
    type AnalyticsSink,
    type Diagnostics,
    type DiagnosticOutcome,
    type DiagnosticSpan,
    decideAd,
    type PurchaseState,
} from '@/domain';
import {isForeground, watchForeground} from '../datasources/platform/ForegroundWatcher';
import {NOOP_DIAGNOSTICS} from './NoopDiagnostics';

const AD_UNIT_ID = 'ca-app-pub-2292299294214510/8726265265';
const AD_SHOW_TIMEOUT_MS = 8000;
const LATE_REVENUE_GRACE_MS = 60000;
const MAX_TRACKING_DURATION_MS = 30 * 60 * 1000;
const LOAD_BACKOFF_MS = [30000, 60000, 120000];
const AD_FORMAT = 'interstitial';
const AD_PLATFORM = 'admob';
const AD_PLACEMENT: AdTrigger = 'movie_open';

interface AdTracking {
    start(): void;
    finish(): void;
    discard(): void;
}

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
    diagnostics?: Diagnostics;
}

function adErrorCode(error: unknown): string {
    const code = error != null && typeof error === 'object' && 'code' in error ? error.code : undefined;
    const known: Record<string, string> = {
        'googleMobileAds/no-fill': 'no_fill',
        'googleMobileAds/mediation-no-fill': 'no_fill',
        'googleMobileAds/error-code-no-fill': 'no_fill',
        'googleMobileAds/network-error': 'network_error',
        'googleMobileAds/invalid-request': 'invalid_request',
        'googleMobileAds/internal-error': 'internal_error',
        'googleMobileAds/app-not-foreground': 'app_not_foreground',
    };
    return typeof code === 'string' ? known[code] ?? 'unknown' : 'unknown';
}

function finishAdFailure(span: DiagnosticSpan, error: unknown): void {
    const errorCode = adErrorCode(error);
    if (errorCode === 'no_fill' || errorCode === 'network_error' || errorCode === 'app_not_foreground') {
        span.finish(errorCode === 'no_fill' ? 'empty' : 'unavailable', {error_code: errorCode});
    } else {
        span.fail(error, {error_code: errorCode});
    }
}

export class AdMobAdGateway implements AdGateway {
    readonly supported = Platform.OS === 'android';

    private readonly options: AdMobAdGatewayOptions;
    private readonly diagnostics: Diagnostics;
    private loadSpan: DiagnosticSpan | null = null;

    private readyPromise: Promise<void> | null = null;
    private interstitial: InterstitialAd | null = null;
    private unsubscribeAd: (() => void) | null = null;
    private adTracking: AdTracking | null = null;
    private retryTimer: ReturnType<typeof setTimeout> | null = null;
    private pending: Promise<boolean> | null = null;
    private initialized = false;
    private loaded = false;
    private loading = false;
    private showing = false;
    private failures = 0;
    private requestSeq = 0;
    private privacyRequired = false;
    private canRequestAds = false;

    constructor(options: AdMobAdGatewayOptions) {
        this.options = options;
        this.diagnostics = options.diagnostics ?? NOOP_DIAGNOSTICS;
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
        const tracking = this.adTracking;
        tracking?.start();
        this.pending = this.present(ad, trigger, () => tracking?.finish());
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
        const span = this.diagnostics.start('ads.initialize', {provider: 'admob'});
        try {
            await this.gatherConsent();
            if (!this.canRequestAds) {
                span.finish('unavailable');
                this.readyPromise = null;
                this.options.analytics.trackEvent('trailer_ad_failed', {reason: 'consent'});
                return;
            }
            await mobileAds().setRequestConfiguration({
                maxAdContentRating: MaxAdContentRating.T,
            });
            await mobileAds().initialize();
            this.initialized = true;
            span.finish();
            this.requestNext();
        } catch (error) {
            span.fail(error);
            this.readyPromise = null;
            this.options.analytics.trackEvent('trailer_ad_failed', {reason: 'init'});
        }
    }

    private async gatherConsent(): Promise<void> {
        this.canRequestAds = false;
        const info = await AdsConsent.gatherConsent().catch(() => {
            this.options.analytics.trackEvent('trailer_ad_failed', {reason: 'consent_error'});
            return AdsConsent.getConsentInfo().catch(() => null);
        });
        if (info == null) return;
        this.canRequestAds = info.canRequestAds;
        this.privacyRequired =
            info.privacyOptionsRequirementStatus ===
            AdsConsentPrivacyOptionsRequirementStatus.REQUIRED;
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
        const span = this.diagnostics.start('ads.load', {provider: 'admob', attempt: this.failures + 1});
        this.loadSpan = span;
        const impression: AdImpression = {
            adUnitId: unitId,
            impressionId: `${unitId}:${Date.now()}:${this.requestSeq}`,
            placement: AD_PLACEMENT,
        };
        const ad = InterstitialAd.createForAdRequest(unitId);
        this.interstitial = ad;
        this.adTracking = this.observeImpression(ad, impression);
        let loadReported = false;
        let loadFailed = false;
        const offLoaded = ad.addAdEventListener(AdEventType.LOADED, () => {
            if (loadReported || loadFailed) return;
            loadReported = true;
            span.finish();
            this.loading = false;
            this.loaded = true;
            this.failures = 0;
            this.options.adRevenue.trackLoaded(impression);
        });
        const offError = ad.addAdEventListener(AdEventType.ERROR, (error) => {
            if (loadFailed) return;
            loadFailed = true;
            finishAdFailure(span, error);
            this.loading = false;
            this.loaded = false;
            this.failures += 1;
            this.options.analytics.trackEvent('trailer_ad_failed', {reason: 'load'});
            // The native bridge exposes symbolic errors, not AdMob's numeric code.
            if (!loadReported) {
                this.options.adRevenue.trackFailedToLoad({adUnitId: unitId, placement: AD_PLACEMENT});
            }
            this.scheduleRetry();
        });
        this.unsubscribeAd = () => {
            offLoaded();
            offError();
        };
        ad.load();
    }

    private observeImpression(ad: InterstitialAd, impression: AdImpression): AdTracking {
        let started = false;
        let finished = false;
        let displayed = false;
        let clicked = false;
        let paid = false;
        let timer: ReturnType<typeof setTimeout> | null = null;

        const dispose = () => {
            if (timer != null) clearTimeout(timer);
            timer = null;
            offPaid();
            offOpened();
            offClicked();
            offClosed();
            offError();
        };
        const finish = () => {
            if (finished) return;
            finished = true;
            offOpened();
            offClicked();
            offClosed();
            offError();
            if (timer != null) clearTimeout(timer);
            // PAID may cross the native bridge after CLOSED. Failed loads cannot earn revenue.
            if (started && !paid) timer = setTimeout(dispose, LATE_REVENUE_GRACE_MS);
            else dispose();
        };

        const offPaid = ad.addAdEventListener(AdEventType.PAID, (payload) => {
            if (paid || !this.reportRevenue(payload as unknown as PaidEvent, impression)) return;
            paid = true;
            offPaid();
            if (finished) dispose();
        });
        const offOpened = ad.addAdEventListener(AdEventType.OPENED, () => {
            if (displayed) return;
            displayed = true;
            // AdMob OPENED means visible; RevenueCat OPENED means the user clicked.
            this.options.adRevenue.trackDisplayed(impression);
        });
        const offClicked = ad.addAdEventListener(AdEventType.CLICKED, () => {
            if (clicked) return;
            clicked = true;
            this.options.adRevenue.trackOpened(impression);
        });
        const offClosed = ad.addAdEventListener(AdEventType.CLOSED, finish);
        const offError = ad.addAdEventListener(AdEventType.ERROR, finish);

        return {
            start: () => {
                started = true;
                // Keep tracking a visible ad beyond the navigation timeout, but bound orphaned listeners.
                timer = setTimeout(dispose, MAX_TRACKING_DURATION_MS);
            },
            finish,
            discard: () => {
                if (!started) dispose();
            },
        };
    }

    private present(ad: InterstitialAd, trigger: AdTrigger, finishTracking: () => void): Promise<boolean> {
        const span = this.diagnostics.start('ads.present', {provider: 'admob'});
        return new Promise<boolean>((resolve) => {
            let settled = false;
            let opened = false;
            let timer: ReturnType<typeof setTimeout> | null = null;
            let offForeground: (() => void) | null = null;

            const settle = (outcome: DiagnosticOutcome = 'ok') => {
                if (settled) return;
                settled = true;
                span.finish(outcome);
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
                        settle('timeout');
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
            const offClosed = ad.addAdEventListener(AdEventType.CLOSED, () => settle());
            const offShowError = ad.addAdEventListener(AdEventType.ERROR, (error) => {
                finishAdFailure(span, error);
                this.options.analytics.trackEvent('trailer_ad_failed', {reason: 'show'});
                settle('error');
            });

            arm();

            const showFailed = (error: unknown) => {
                finishAdFailure(span, error);
                this.options.analytics.trackEvent('trailer_ad_failed', {reason: 'show'});
                finishTracking();
                settle('error');
            };
            try {
                void ad.show().catch(showFailed);
            } catch (error) {
                showFailed(error);
            }
        });
    }

    private reportRevenue(paid: PaidEvent | undefined, impression: AdImpression): boolean {
        const raw = paid?.value;
        const currency = typeof paid?.currency === 'string' ? paid.currency.trim().toUpperCase() : '';
        if (typeof raw !== 'number' || !Number.isFinite(raw) || raw < 0 ||
            !Number.isSafeInteger(Math.round(raw * 1000000)) || !/^[A-Z]{3}$/.test(currency)) {
            return false;
        }
        const value = raw;
        const precision = PRECISION[paid?.precision as number] ?? 'unknown';
        this.options.analytics.trackEvent('ad_impression', {
            ad_platform: AD_PLATFORM,
            ad_format: AD_FORMAT,
            ad_unit_name: impression.adUnitId,
            currency,
            value,
            precision,
        });
        this.options.adRevenue.trackImpression({
            ...impression,
            value,
            currency,
            precision,
        });
        return true;
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
        this.loadSpan?.finish('cancelled');
        this.loadSpan = null;
        this.unsubscribeAd?.();
        this.unsubscribeAd = null;
        this.adTracking?.discard();
        this.adTracking = null;
        this.interstitial = null;
    }
}
