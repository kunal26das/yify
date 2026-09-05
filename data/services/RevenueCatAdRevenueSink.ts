import Purchases, {AdFormat, AdMediatorName} from 'react-native-purchases';

import type {AdImpressionRevenue, AdRevenueSink} from '@/domain';

export class RevenueCatAdRevenueSink implements AdRevenueSink {
    private readonly ready: () => boolean;

    constructor(ready: () => boolean) {
        this.ready = ready;
    }

    trackImpression(revenue: AdImpressionRevenue): void {
        if (!this.ready()) return;
        try {
            void Purchases.adTracker
                .trackAdRevenue({
                    mediatorName: AdMediatorName.adMob,
                    adFormat: AdFormat.interstitial,
                    adUnitId: revenue.adUnitId,
                    impressionId: revenue.impressionId,
                    revenueMicros: Math.round(revenue.value * 1000000),
                    currency: revenue.currency,
                    precision: revenue.precision,
                })
                .catch(() => {
                });
        } catch {
        }
    }
}
