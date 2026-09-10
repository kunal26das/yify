import type {DisplayAds, PurchaseRepository} from '@/domain';

export class AdSenseDisplayAds implements DisplayAds {
    readonly supported: boolean;

    constructor(_purchases: PurchaseRepository) {
        this.supported = false;
    }

    attach(): () => void {
        return () => {};
    }
}
