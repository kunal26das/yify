import {SubscriberAccessError} from './errors';
import {fetchSubscriberJson} from './http';

const PROJECT_ID = '8b6ff243';
const ENTITLEMENT_ID = 'entl2b0b9c6396';

function object(value: unknown): Record<string, unknown> | undefined {
    return value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : undefined;
}

function grantsAccess(value: unknown, productIds: ReadonlySet<string>, now: number): boolean {
    const subscription = object(value);
    if (!subscription || subscription.object !== 'subscription' || subscription.environment !== 'production'
        || subscription.gives_access !== true || typeof subscription.product_id !== 'string' || !productIds.has(subscription.product_id)
        || !['play_store', 'rc_billing', 'stripe'].includes(String(subscription.store))
        || !['active', 'trialing', 'in_grace_period'].includes(String(subscription.status))) return false;
    if (!Number.isSafeInteger(subscription.starts_at) || (subscription.starts_at as number) > now
        || !Number.isSafeInteger(subscription.current_period_starts_at) || (subscription.current_period_starts_at as number) > now
        || !Number.isSafeInteger(subscription.ends_at) || (subscription.ends_at as number) <= 0
        || (subscription.status !== 'in_grace_period' && (subscription.ends_at as number) <= now)) return false;
    const entitlements = object(subscription.entitlements);
    return entitlements?.object === 'list' && Array.isArray(entitlements.items) && entitlements.items.some(value => {
        const entitlement = object(value);
        return entitlement?.object === 'entitlement' && entitlement.state === 'active'
            && entitlement.id === ENTITLEMENT_ID && entitlement.lookup_key === 'remove_ads' && entitlement.project_id === PROJECT_ID;
    });
}

export async function verifyRecurringSubscription(
    uid: string,
    options: {apiKey: string; productIds: ReadonlySet<string>; fetch: typeof fetch; now: () => number; timeoutMs: number},
    signal: AbortSignal,
): Promise<void> {
    const base = new URL(`https://api.revenuecat.com/v2/projects/${PROJECT_ID}/customers/${encodeURIComponent(uid)}/subscriptions`);
    let cursor: string | undefined;
    const visited = new Set<string>();
    for (let page = 0; page < 3; page++) {
        if (signal.aborted) throw new SubscriberAccessError(503);
        const url = new URL(base);
        url.searchParams.set('environment', 'production');
        url.searchParams.set('limit', '100');
        if (cursor) url.searchParams.set('starting_after', cursor);
        const response = await fetchSubscriberJson(options.fetch, url.href, {
            headers: {Authorization: `Bearer ${options.apiKey}`, Accept: 'application/json'},
        }, signal, options.timeoutMs, 2_000_000);
        if (response.status === 404) throw new SubscriberAccessError(403);
        if (response.status !== 200) throw new SubscriberAccessError(503);
        const result = object(response.value);
        if (result?.object !== 'list' || !Array.isArray(result.items) || result.items.length > 100) throw new SubscriberAccessError(503);
        if (result.items.some(item => grantsAccess(item, options.productIds, options.now()))) return;
        if (result.next_page == null) throw new SubscriberAccessError(403);
        if (typeof result.next_page !== 'string') throw new SubscriberAccessError(503);
        try {
            const next = new URL(result.next_page, base);
            const keys = [...next.searchParams.keys()];
            cursor = next.searchParams.get('starting_after') ?? undefined;
            if (next.origin !== base.origin || next.pathname !== base.pathname || next.username || next.password || next.hash
                || new Set(keys).size !== keys.length || keys.some(key => !['starting_after', 'environment', 'limit'].includes(key))
                || !cursor || cursor.length > 255 || !/^[a-zA-Z\d_-]+$/.test(cursor) || visited.has(cursor)
                || (next.searchParams.has('environment') && next.searchParams.get('environment') !== 'production')) {
                throw new SubscriberAccessError(503);
            }
            visited.add(cursor);
        } catch {
            throw new SubscriberAccessError(503);
        }
    }
    throw new SubscriberAccessError(503);
}
