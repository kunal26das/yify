import type {PurchaseFailure, PurchaseOffer, PurchasePlacement} from '../entities/Entitlement';
import type {AnalyticsParams, AnalyticsSink} from '../services/AnalyticsSink';

export interface SubscriptionFunnelContext {
    platform: string;
    country?: string | null;
}

type CheckoutOffer = Pick<PurchaseOffer, 'recurring' | 'billingPeriod' | 'placement'>;

export type SubscriptionFunnelEvent =
    | {step: 'paywall_view'; placement: PurchasePlacement; signedIn: boolean; supporter: boolean}
    | {step: 'offers_visible'; placement: PurchasePlacement; offerCount: number}
    | {step: 'paywall_closed'; placement: PurchasePlacement; supporter: boolean}
    | {step: 'checkout_started'; offer: CheckoutOffer}
    | {step: 'checkout_finished'; offer?: CheckoutOffer; outcome: PurchaseFailure | 'granted'}
    | {step: 'watchlist_milestone'; milestone: 1 | 3}
    | {step: 'streaming_services_saved'; selectedCount: number}
    | {step: 'streaming_country_selected'; method: 'manual' | 'location'}
    | {step: 'watch_option_opened'; mediaType: 'movie' | 'show'; source: 'details' | 'watchlist'}
    | {step: 'availability_alert_changed'; enabled: boolean};

function placement(value: unknown): PurchasePlacement | 'unknown' {
    return value === 'settings_supporter' || value === 'post_ad_supporter' || value === 'journal_insights' ||
        value === 'watchlist_supporter' || value === 'supporter_page' ? value : 'unknown';
}

function promptSource(value: unknown): string {
    switch (value) {
        case 'settings_supporter': return 'settings';
        case 'post_ad_supporter': return 'post_ad';
        case 'journal_insights': return 'journal';
        case 'watchlist_supporter': return 'watchlist';
        case 'supporter_page': return 'supporter_page';
        default: return 'unknown';
    }
}

function planKind(offer?: CheckoutOffer): string {
    if (!offer) return 'unknown';
    if (!offer.recurring) return 'one_time';
    return offer.billingPeriod === 'P1M' ? 'monthly' : 'recurring';
}

export function trackSubscriptionFunnel(
    sink: Pick<AnalyticsSink, 'trackEvent'> | null | undefined,
    event: SubscriptionFunnelEvent,
    context: SubscriptionFunnelContext,
): void {
    if (!sink) return;
    const params: AnalyticsParams = {
        funnel_version: 'v1',
        app_platform: ['android', 'ios', 'web'].includes(context.platform) ? context.platform : 'other',
    };
    const country = typeof context.country === 'string' ? context.country.trim().toUpperCase() : '';
    if (/^[A-Z]{2}$/.test(country)) params.viewing_country = country;
    let name: string;
    switch (event.step) {
        case 'paywall_view':
            name = 'supporter_prompt';
            params.placement = placement(event.placement);
            params.source = promptSource(event.placement);
            params.signed_in = event.signedIn === true ? 'true' : 'false';
            params.supporter_access = event.supporter === true ? 'true' : 'false';
            break;
        case 'offers_visible':
            if (!Number.isSafeInteger(event.offerCount) || event.offerCount < 1) return;
            name = 'supporter_offers_visible';
            params.placement = placement(event.placement);
            params.offer_count = Math.min(event.offerCount, 10);
            break;
        case 'paywall_closed':
            name = 'supporter_paywall_closed';
            params.placement = placement(event.placement);
            params.supporter_access = event.supporter === true ? 'true' : 'false';
            break;
        case 'checkout_started':
            name = 'remove_ads_purchase_start';
            params.placement = placement(event.offer.placement);
            params.plan_kind = planKind(event.offer);
            break;
        case 'checkout_finished': {
            params.placement = placement(event.offer?.placement);
            params.plan_kind = planKind(event.offer);
            const outcome = ['granted', 'not_granted', 'cancelled', 'pending', 'already_purchased', 'offer_unavailable', 'restore_failed'].includes(event.outcome)
                ? event.outcome : 'unknown';
            if (outcome === 'granted' || outcome === 'not_granted') {
                name = 'remove_ads_purchase_done';
                params.granted = outcome === 'granted' ? 'true' : 'false';
            } else {
                name = 'remove_ads_purchase_failed';
                params.reason = outcome;
            }
            break;
        }
        case 'watchlist_milestone':
            if (event.milestone !== 1 && event.milestone !== 3) return;
            name = 'watchlist_activation';
            params.saved_milestone = event.milestone === 1 ? 'one' : 'three';
            break;
        case 'streaming_services_saved':
            if (!Number.isSafeInteger(event.selectedCount) || event.selectedCount < 0) return;
            name = 'streaming_services_saved';
            params.service_count = event.selectedCount === 0 ? 'none' : event.selectedCount === 1 ? 'one'
                : event.selectedCount <= 3 ? 'two_to_three' : 'four_plus';
            break;
        case 'streaming_country_selected':
            if (event.method !== 'manual' && event.method !== 'location') return;
            name = 'streaming_country_selected';
            params.method = event.method;
            break;
        case 'watch_option_opened':
            if (!['movie', 'show'].includes(event.mediaType) || !['details', 'watchlist'].includes(event.source)) return;
            name = 'watch_option_opened';
            params.media_type = event.mediaType;
            params.source = event.source;
            break;
        case 'availability_alert_changed':
            name = 'availability_alert_changed';
            params.enabled = event.enabled === true ? 'true' : 'false';
            break;
        default:
            return;
    }
    try {
        sink.trackEvent(name, params);
    } catch {}
}
