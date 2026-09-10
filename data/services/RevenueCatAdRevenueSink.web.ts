import type {AdRevenueSink, AnalyticsSink, Diagnostics} from '@/domain';

export class RevenueCatAdRevenueSink implements AdRevenueSink {
    constructor(_analytics: AnalyticsSink, _diagnostics?: Diagnostics) {
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
