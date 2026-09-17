export type StreamingOfferType = 'subscription' | 'addon' | 'free' | 'ads' | 'rent' | 'buy';

export interface StreamingOffer {
    serviceId: string;
    serviceName: string;
    selectionId: string;
    addonName?: string;
    type: StreamingOfferType;
    url?: string;
    price?: string;
    quality?: string;
}
