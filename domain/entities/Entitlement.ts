export const REMOVE_ADS_ENTITLEMENT = 'remove_ads';

export const LIFETIME_PACKAGE = '$rc_lifetime';

export interface PurchaseOffer {
    id: string;
    title: string;
    priceLabel: string;
}

export interface PurchaseState {
    ready: boolean;
    available: boolean;
    adsRemoved: boolean;
    offers: PurchaseOffer[];
    purchasing: string | null;
    failure: string | null;
}

export const INITIAL_PURCHASE_STATE: PurchaseState = {
    ready: false,
    available: false,
    adsRemoved: false,
    offers: [],
    purchasing: null,
    failure: null,
};
