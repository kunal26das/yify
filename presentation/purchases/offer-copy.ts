import type {PurchaseFailure, PurchaseOffer, PurchaseState} from '@/domain';

export function billingPeriodLabel(period?: string | null): string | null {
    const match = /^P(\d+)([DWMY])$/.exec(period ?? '');
    if (!match || !Number.isSafeInteger(Number(match[1])) || Number(match[1]) < 1) return null;
    const count = Number(match[1]);
    const unit = {D: 'day', W: 'week', M: 'month', Y: 'year'}[match[2]];
    return `${count === 1 ? '' : `${count} `}${unit}${count === 1 ? '' : 's'}`;
}

export function offerDisclosure(offer: PurchaseOffer): string {
    if (!offer.recurring) return `${offer.priceLabel} once. No renewal.`;
    const period = billingPeriodLabel(offer.billingPeriod);
    if (offer.autoRenewing === false) {
        return `${offer.priceLabel}${period ? ` for ${period === 'month' || period === 'year' || period === 'week' || period === 'day' ? '1 ' : ''}${period}` : ''}. Prepaid access; does not renew automatically.`;
    }
    return `${offer.priceLabel}${period ? ` every ${period}` : ' per billing period'}. Renews automatically until cancelled.`;
}

export function supporterStatus(state: PurchaseState): string {
    if (state.billingIssue) return 'There is a payment issue. Open billing settings to update your payment method.';
    const date = state.expiresAt ? new Date(state.expiresAt) : null;
    const formatted = date && Number.isFinite(date.getTime()) ? date.toLocaleDateString() : null;
    if (state.adsRemoved && formatted) {
        return state.willRenew ? `Your support renews on ${formatted}.` : `Your access continues until ${formatted}.`;
    }
    if (state.adsRemoved) return 'Thank you. Your supporter access is active and Yify ads are off.';
    if (formatted && date!.getTime() <= Date.now()) return `Your supporter access ended on ${formatted}. Restore purchases or open billing settings to check your subscription.`;
    return 'Already paid? Restore your purchases or check your account access below.';
}

export function purchaseFailureMessage(failure: PurchaseFailure | null): string | null {
    switch (failure) {
        case null:
        case 'cancelled': return null;
        case 'pending': return 'Your payment is pending. Access will update when the store confirms it. You do not need to pay again.';
        case 'already_purchased': return 'The store reports an existing purchase. Use Restore purchases to recover access.';
        case 'not_granted': return 'The purchase has not unlocked access yet. Check access again shortly. You do not need to pay again.';
        case 'offer_unavailable': return 'This plan is no longer available. Reload the plans and try again.';
        case 'restore_failed': return 'We could not restore purchases. Check your connection and try again.';
        default: return 'The payment could not be completed. If you were charged, check access before trying again.';
    }
}

export function safeManagementURL(value: string | null): string | null {
    if (!value) return null;
    try {
        const url = new URL(value);
        return url.protocol === 'https:' && !url.username && !url.password ? url.toString() : null;
    } catch {
        return null;
    }
}
