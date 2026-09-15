import {SubscriberAccessError} from './errors';
import {createFirebaseTokenVerifier} from './firebase';
import {verifyRecurringSubscription} from './revenuecat';

export {SubscriberAccessError} from './errors';

interface SubscriberAuthorizerOptions {
    firebaseProjectId?: string;
    ownerUid?: string;
    revenueCatApiKey?: string;
    revenueCatProductIds?: readonly string[];
    fetch?: typeof fetch;
    now?: () => number;
    timeoutMs?: number;
}

export function createSubscriberAuthorizer(options: SubscriberAuthorizerOptions = {}): (request: Request, signal: AbortSignal) => Promise<{uid: string}> {
    const fetcher: typeof fetch = options.fetch ?? ((input, init) => fetch(input, init));
    const now = options.now ?? Date.now;
    const timeoutMs = options.timeoutMs ?? 5000;
    const verifyToken = createFirebaseTokenVerifier({fetch: fetcher, now, timeoutMs});
    return async (request, signal) => {
        const header = request.headers.get('Authorization');
        if (!header || header.length > 16_384 || !/^Bearer [a-zA-Z\d_-]+\.[a-zA-Z\d_-]+\.[a-zA-Z\d_-]+$/i.test(header)) {
            throw new SubscriberAccessError(401);
        }
        const projectId = options.firebaseProjectId ?? process.env.YIFY_SUBSCRIBER_FIREBASE_PROJECT_ID;
        const configuredOwner: unknown = options.ownerUid ?? process.env.YIFY_SUBSCRIBER_OWNER_UID;
        const ownerUid = typeof configuredOwner === 'string' && !configuredOwner.trim() ? undefined : configuredOwner;
        if (!projectId || !/^[a-z][a-z\d-]{4,28}[a-z\d]$/.test(projectId)
            || (ownerUid !== undefined && (typeof ownerUid !== 'string' || ownerUid.length > 128
                || ownerUid !== ownerUid.trim() || ownerUid === '.' || ownerUid === '..'
                || /[\u0000-\u001f\u007f]/.test(ownerUid)))) {
            throw new SubscriberAccessError(503);
        }
        const uid = await verifyToken(header.slice(7), projectId, signal);
        if (signal.aborted) throw new SubscriberAccessError(503);
        if (uid === ownerUid) return {uid};
        const apiKey = options.revenueCatApiKey ?? process.env.YIFY_SUBSCRIBER_REVENUECAT_API_KEY;
        const configuredProducts: unknown = process.env.YIFY_SUBSCRIBER_REVENUECAT_PRODUCT_IDS;
        const productIds = options.revenueCatProductIds ?? (typeof configuredProducts === 'string'
            ? configuredProducts.split(',').map(value => value.trim()) : undefined);
        if (!apiKey || !/^sk_[a-zA-Z\d_-]{16,500}$/.test(apiKey)
            || !productIds?.length || productIds.length > 16 || productIds.some(id => typeof id !== 'string' || !/^prod[a-zA-Z\d]{4,60}$/.test(id))) {
            throw new SubscriberAccessError(503);
        }
        await verifyRecurringSubscription(uid, {apiKey, productIds: new Set(productIds), fetch: fetcher, now, timeoutMs}, signal);
        if (signal.aborted) throw new SubscriberAccessError(503);
        return {uid};
    };
}
