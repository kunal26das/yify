import type {AdRevenueSink, AnalyticsSink, Diagnostics, PrivacyPreferences} from '@/domain';

export class RevenueCatAdRevenueSink implements AdRevenueSink {
    constructor(_analytics: AnalyticsSink, _diagnostics?: Diagnostics, _privacy?: PrivacyPreferences) {
    }

    trackLoaded(): void {
    }

    trackDisplayed(): void {
    }

    trackOpened(): void {
    }

    trackFailedToLoad(): void {
    }

    trackImpression(): void {
    }
}
