export const REMOVE_ADS_ENTITLEMENT = 'remove_ads';

export interface PurchaseOffer {
    id: string;
    title: string;
    priceLabel: string;
    recurring: boolean;
}

export type PurchaseFailure =
    | 'cancelled'
    | 'already_purchased'
    | 'pending'
    | 'not_granted'
    | 'offer_unavailable'
    | 'restore_failed'
    | 'unknown';

export interface PurchaseState {
    ready: boolean;
    available: boolean;
    adsRemoved: boolean;
    offers: PurchaseOffer[];
    purchasing: string | null;
    failure: PurchaseFailure | null;
}

export const INITIAL_PURCHASE_STATE: PurchaseState = {
    ready: false,
    available: false,
    adsRemoved: false,
    offers: [],
    purchasing: null,
    failure: null,
};
