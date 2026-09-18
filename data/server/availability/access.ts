import {createFirebaseTokenVerifier} from '../subscribers/firebase';
import {verifyRecurringSubscription} from '../subscribers/revenuecat';
import {SubscriberAccessError} from '../subscribers/errors';

interface Options {
    environment?: () => Record<string, string | undefined>;
    verifyIdentity?: (token: string, project: string, signal: AbortSignal) => Promise<string>;
    verifySubscription?: (uid: string, signal: AbortSignal) => Promise<void>;
}

// This endpoint describes enrollment eligibility; it never exposes a subscriber record.
export function createAvailabilityAccessHandler(options: Options = {}) {
    const environment: () => Record<string, string | undefined> = options.environment ?? (() => process.env);
    const verifyIdentity = options.verifyIdentity ?? createFirebaseTokenVerifier({fetch, now: Date.now, timeoutMs: 5000});
    return async (request: Request): Promise<Response> => {
        const headers = new Headers({
            'Content-Type': 'application/json', 'Cache-Control': 'private, no-store',
            'Access-Control-Allow-Origin': '*', 'Vary': 'Authorization',
            'X-Content-Type-Options': 'nosniff',
        });
        const respond = (status: number, enabled = false) => new Response(JSON.stringify({enabled, titleLimit: 20}), {status, headers});
        if (request.method === 'OPTIONS') {
            headers.set('Access-Control-Allow-Methods', 'GET, OPTIONS');
            headers.set('Access-Control-Allow-Headers', 'Authorization, Accept');
            return new Response(null, {status: 204, headers});
        }
        if (request.method !== 'GET') return respond(405);
        const env = environment();
        if (env.AVAILABILITY_ALERTS_PILOT_ENABLED !== 'true' || env.TMDB_COMMERCIAL_LICENSE_CONFIRMED !== 'true') return respond(200);
        const allowed = (env.AVAILABILITY_ALERTS_PILOT_UIDS ?? '').split(',').map(value => value.trim()).filter(Boolean);
        if (!allowed.length || allowed.length > 20 || allowed.some(uid => uid.startsWith('_') || uid.length > 128 || /[\u0000-\u0020\u007f/]/.test(uid))) return respond(503);
        const project = env.YIFY_SUBSCRIBER_FIREBASE_PROJECT_ID;
        if (!project || !/^[a-z][a-z\d-]{4,28}[a-z\d]$/.test(project)) return respond(503);
        const authorization = request.headers.get('Authorization') ?? '';
        if (authorization.length > 16_384 || !/^Bearer [a-zA-Z\d_-]+\.[a-zA-Z\d_-]+\.[a-zA-Z\d_-]+$/i.test(authorization)) return respond(401);
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 15_000);
        try {
            const uid = await verifyIdentity(authorization.slice(7), project, controller.signal);
            if (!allowed.includes(uid)) return respond(200);
            if (options.verifySubscription) await options.verifySubscription(uid, controller.signal);
            else {
                const apiKey = env.YIFY_SUBSCRIBER_REVENUECAT_API_KEY;
                const products = (env.YIFY_SUBSCRIBER_REVENUECAT_PRODUCT_IDS ?? '').split(',').map(value => value.trim());
                if (!apiKey || !/^sk_[a-zA-Z\d_-]{16,500}$/.test(apiKey) || !products.length || products.length > 16 ||
                    products.some(id => !/^prod[a-zA-Z\d]{4,60}$/.test(id))) return respond(503);
                await verifyRecurringSubscription(uid, {apiKey, productIds: new Set(products), fetch, now: Date.now, timeoutMs: 5000}, controller.signal);
            }
            return respond(controller.signal.aborted ? 503 : 200, !controller.signal.aborted);
        } catch (error) {
            return respond(error instanceof SubscriberAccessError ? error.status : 503);
        } finally {clearTimeout(timeout);}
    };
}
