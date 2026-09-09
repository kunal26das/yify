import type {Account} from '../entities/Account';
import type {PurchaseOffer, PurchasePlacement, PurchaseState} from '../entities/Entitlement';

export interface PurchaseRepository {
    init(): Promise<void>;

    getState(): PurchaseState;

    subscribe(listener: () => void): () => void;

    purchase(offerId: string): Promise<boolean>;

    restore(): Promise<boolean>;

    refresh(): Promise<void>;

    getOffers(placement: PurchasePlacement): Promise<PurchaseOffer[]>;

    trackPaywallImpression(offerId: string): void;

    identify(account: Account | null): Promise<void>;
}
