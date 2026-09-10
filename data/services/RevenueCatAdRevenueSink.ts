import Purchases, {AdFormat, AdMediatorName} from 'react-native-purchases';

import type {AdImpression, AdImpressionRevenue, AdLoadFailure, AdRevenueSink, AnalyticsSink, Diagnostics} from '@/domain';
import {NOOP_DIAGNOSTICS} from './NoopDiagnostics';

type TrackingEvent = 'loaded' | 'displayed' | 'opened' | 'revenue' | 'failed_to_load';

function impressionData(impression: AdImpression) {
    return {
        mediatorName: AdMediatorName.adMob,
        adFormat: AdFormat.interstitial,
        adUnitId: impression.adUnitId,
        impressionId: impression.impressionId,
        placement: impression.placement,
        networkName: impression.networkName,
    };
}

export class RevenueCatAdRevenueSink implements AdRevenueSink {
    constructor(private readonly analytics: AnalyticsSink, private readonly diagnostics: Diagnostics = NOOP_DIAGNOSTICS) {
    }

    trackLoaded(impression: AdImpression): void {
        this.track('loaded', () => Purchases.adTracker.trackAdLoaded(impressionData(impression)));
    }

    trackDisplayed(impression: AdImpression): void {
        this.track('displayed', () => Purchases.adTracker.trackAdDisplayed(impressionData(impression)));
    }

    trackOpened(impression: AdImpression): void {
        this.track('opened', () => Purchases.adTracker.trackAdOpened(impressionData(impression)));
    }

    trackFailedToLoad(failure: AdLoadFailure): void {
        this.track('failed_to_load', () => Purchases.adTracker.trackAdFailedToLoad({
            mediatorName: AdMediatorName.adMob,
            adFormat: AdFormat.interstitial,
            adUnitId: failure.adUnitId,
            placement: failure.placement,
            mediatorErrorCode: failure.mediatorErrorCode,
        }));
    }

    trackImpression(revenue: AdImpressionRevenue): void {
        const revenueMicros = Math.round(revenue.value * 1_000_000);
        if (!Number.isFinite(revenue.value) || revenue.value < 0 ||
            !Number.isSafeInteger(revenueMicros) || !/^[A-Z]{3}$/.test(revenue.currency)) {
            this.reportFailure('revenue', 'invalid_payload');
            return;
        }
        this.track('revenue', () => Purchases.adTracker.trackAdRevenue({
            ...impressionData(revenue),
            revenueMicros,
            currency: revenue.currency,
            precision: revenue.precision,
        }));
    }

    private track(event: TrackingEvent, send: () => Promise<void>): void {
        // AdTracker checks SDK configuration itself. CustomerInfo/offerings may
        // still be loading, but that must not discard valid ad callbacks.
        const span = this.diagnostics.start('ads.revenue_delivery', {provider: 'revenuecat', stage: event});
        try {
            void send().then(() => span.finish()).catch((error) => {
                span.fail(error);
                this.reportFailure(event, 'sdk');
            });
        } catch (error) {
            span.fail(error);
            this.reportFailure(event, 'sdk');
        }
    }

    private reportFailure(event: TrackingEvent, reason: string): void {
        this.diagnostics.event('ads.revenue_delivery_failure', {provider: 'revenuecat', stage: event, reason, outcome: 'error'});
        try {
            this.analytics.trackEvent('ad_tracking_failed', {provider: 'revenuecat', event, reason});
        } catch {
            // Diagnostics must never interrupt an ad or retry a revenue event.
        }
    }
}
