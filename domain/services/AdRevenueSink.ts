export type AdRevenuePrecision = 'exact' | 'publisher_defined' | 'estimated' | 'unknown';

export interface AdImpression {
    adUnitId: string;
    impressionId: string;
    placement?: string;
    networkName?: string;
}

export interface AdLoadFailure {
    adUnitId: string;
    placement?: string;
    mediatorErrorCode?: number;
}

export interface AdImpressionRevenue extends AdImpression {
    value: number;
    currency: string;
    precision: AdRevenuePrecision;
}

export interface AdRevenueSink {
    trackLoaded(impression: AdImpression): void;
    trackDisplayed(impression: AdImpression): void;
    trackOpened(impression: AdImpression): void;
    trackFailedToLoad(failure: AdLoadFailure): void;
    trackImpression(revenue: AdImpressionRevenue): void;
}
