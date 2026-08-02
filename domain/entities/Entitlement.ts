export const REMOVE_ADS_ENTITLEMENT = 'remove_ads';

export interface PurchaseOffer {
    id: string;
    title: string;
    priceLabel: string;
}

export interface PurchaseState {
    ready: boolean;
    adsRemoved: boolean;
    offers: PurchaseOffer[];
}

export const INITIAL_PURCHASE_STATE: PurchaseState = {
    ready: false,
    adsRemoved: false,
    offers: [],
};
