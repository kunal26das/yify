import type {StreamingAvailability, StreamingOffer} from '../entities/Streaming';

export function safeStreamingUrl(value: unknown): string | undefined {
    if (typeof value !== 'string' || value.length > 2048) return undefined;
    try {
        const url = new URL(value);
        if (url.protocol !== 'https:' || url.username || url.password || url.port || !url.hostname.includes('.')
            || /(^|\.)(localhost|local|internal|test|invalid)$/.test(url.hostname)
            || /^[\d.]+$/.test(url.hostname) || url.hostname.includes(':')) return undefined;
        return url.toString();
    } catch {
        return undefined;
    }
}

export function streamingOfferSelected(offer: StreamingOffer, services: readonly string[]): boolean {
    return ['subscription', 'addon', 'free', 'ads'].includes(offer.type) && services.includes(offer.selectionId);
}

export function hasSelectedStreamingOffer(availability: StreamingAvailability | null | undefined,
    country: string, services: readonly string[]): boolean {
    return availability?.status === 'ready' && availability.country === country
        && availability.offers.some(offer => streamingOfferSelected(offer, services));
}

export function streamingOfferLabel(offer: StreamingOffer): string {
    switch (offer.type) {
        case 'subscription': return 'Subscription';
        case 'addon': return `Extra channel${offer.addonName ? ` · ${offer.addonName}` : ''}`;
        case 'free': return 'Free';
        case 'ads': return 'Free with ads';
        case 'rent': return `Rent${offer.price ? ` · ${offer.price}` : ''}`;
        case 'buy': return `Buy${offer.price ? ` · ${offer.price}` : ''}`;
    }
}
