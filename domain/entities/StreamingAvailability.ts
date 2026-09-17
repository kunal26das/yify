import type {StreamingOffer} from './StreamingOffer';

export interface StreamingAvailability {
    country: string;
    status: 'ready' | 'unsupported-country' | 'unavailable';
    offers: StreamingOffer[];
    checkedAt?: number;
}
