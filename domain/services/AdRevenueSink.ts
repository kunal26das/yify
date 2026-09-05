export type AdRevenuePrecision = 'exact' | 'publisher_defined' | 'estimated' | 'unknown';

export interface AdImpressionRevenue {
    adUnitId: string;
    impressionId: string;
    value: number;
    currency: string;
    precision: AdRevenuePrecision;
}

export interface AdRevenueSink {
    trackImpression(revenue: AdImpressionRevenue): void;
}
