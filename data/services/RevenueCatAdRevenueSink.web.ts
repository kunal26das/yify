import type {AdRevenueSink, AnalyticsSink} from '@/domain';

export class RevenueCatAdRevenueSink implements AdRevenueSink {
    constructor(_analytics: AnalyticsSink) {
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
