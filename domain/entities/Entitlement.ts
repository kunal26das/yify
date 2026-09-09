export const REMOVE_ADS_ENTITLEMENT = 'remove_ads';

export type PurchasePlacement = 'settings_supporter' | 'post_ad_supporter';

export interface PurchaseOffer {
    id: string;
    title: string;
    priceLabel: string;
    recurring: boolean;
    autoRenewing?: boolean;
    billingPeriod?: string | null;
    offeringId?: string;
    placement?: PurchasePlacement;
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
    restoring: boolean;
    refreshing: boolean;
    managementURL: string | null;
    expiresAt: string | null;
    willRenew: boolean;
    billingIssue: boolean;
}

export const INITIAL_PURCHASE_STATE: PurchaseState = {
    ready: false,
    available: false,
    adsRemoved: false,
    offers: [],
    purchasing: null,
    failure: null,
    restoring: false,
    refreshing: false,
    managementURL: null,
    expiresAt: null,
    willRenew: false,
    billingIssue: false,
};
