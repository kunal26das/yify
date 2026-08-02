import type {Account} from '../entities/Account';
import type {PurchaseState} from '../entities/Entitlement';

export interface PurchaseRepository {
    init(): Promise<void>;

    getState(): PurchaseState;

    subscribe(listener: () => void): () => void;

    purchase(offerId: string): Promise<boolean>;

    restore(): Promise<boolean>;

    identify(account: Account | null): Promise<void>;
}
