import type {AdRevenueSink} from '@/domain';

export class RevenueCatAdRevenueSink implements AdRevenueSink {
    constructor(_ready: () => boolean) {
    }

    trackImpression(): void {
    }
}
