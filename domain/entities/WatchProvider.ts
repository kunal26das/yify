export type WatchOffer = 'stream' | 'rent' | 'buy';

export interface WatchProvider {
    id: number;
    name: string;
    offer: WatchOffer;
    logoUrl?: string;
}

export interface WatchAvailability {
    region: string;
    providers: WatchProvider[];
}
