export type WatchOffer = 'stream' | 'free' | 'ads' | 'rent' | 'buy';

export interface WatchRegion {
    code: string;
    name: string;
}

export interface WatchProvider {
    id: number;
    name: string;
    offer: WatchOffer;
    logoUrl?: string;
}

export interface WatchAvailability {
    region: string;
    providers: WatchProvider[];
    url?: string;
}
