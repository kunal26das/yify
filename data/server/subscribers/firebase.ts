import {createLocalJWKSet, decodeProtectedHeader, errors, jwtVerify} from 'jose';
import type {JSONWebKeySet} from 'jose';
import {SubscriberAccessError} from './errors';
import {fetchSubscriberJson} from './http';

const GOOGLE_KEYS = 'https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com';

interface KeyCache {
    resolve: ReturnType<typeof createLocalJWKSet>;
    expiresAt: number;
    fetchedAt: number;
}

export function createFirebaseTokenVerifier(options: {fetch: typeof fetch; now: () => number; timeoutMs: number}) {
    let cache: KeyCache | undefined;

    const loadKeys = async (signal: AbortSignal): Promise<KeyCache> => {
        const response = await fetchSubscriberJson(options.fetch, GOOGLE_KEYS, {headers: {Accept: 'application/json'}}, signal, options.timeoutMs, 128_000);
        const value = response.value as JSONWebKeySet | undefined;
        if (response.status !== 200 || !value || !Array.isArray(value.keys) || value.keys.length < 1 || value.keys.length > 20) {
            throw new SubscriberAccessError(503);
        }
        if (value.keys.some(key => !key || key.kty !== 'RSA' || typeof key.kid !== 'string' || !key.kid
            || key.alg !== 'RS256' || key.use !== 'sig' || typeof key.n !== 'string' || typeof key.e !== 'string')) {
            throw new SubscriberAccessError(503);
        }
        const maximumAge = Number(response.headers.get('Cache-Control')?.match(/(?:^|,)\s*max-age=(\d+)/i)?.[1] ?? 0);
        const age = Number(response.headers.get('Age') ?? 0);
        const ttl = Math.max(0, Math.min(21_600, maximumAge - (Number.isFinite(age) ? age : maximumAge))) * 1000;
        const fetchedAt = options.now();
        const next = {resolve: createLocalJWKSet(value), fetchedAt, expiresAt: fetchedAt + ttl};
        if (signal.aborted) throw new SubscriberAccessError(503);
        cache = next;
        return next;
    };

    return async (token: string, projectId: string, signal: AbortSignal): Promise<string> => {
        if (signal.aborted) throw new SubscriberAccessError(503);
        try {
            const header = decodeProtectedHeader(token);
            if (header.alg !== 'RS256' || typeof header.kid !== 'string' || !header.kid || header.kid.length > 256) {
                throw new SubscriberAccessError(401);
            }
        } catch {
            throw new SubscriberAccessError(401);
        }
        let keys = cache && cache.expiresAt > options.now() ? cache : await loadKeys(signal);
        const verify = () => jwtVerify(token, keys.resolve, {
            algorithms: ['RS256'],
            issuer: `https://securetoken.google.com/${projectId}`,
            audience: projectId,
            requiredClaims: ['exp', 'iat', 'auth_time', 'sub', 'aud', 'iss'],
            currentDate: new Date(options.now()),
            clockTolerance: 0,
        });
        try {
            let verified;
            try {
                verified = await verify();
            } catch (error) {
                if (!(error instanceof errors.JWKSNoMatchingKey) || options.now() - keys.fetchedAt < 30_000) throw error;
                keys = await loadKeys(signal);
                verified = await verify();
            }
            const payload = verified.payload;
            const now = Math.floor(options.now() / 1000);
            if (payload.aud !== projectId || typeof payload.sub !== 'string' || !payload.sub.trim() || payload.sub.length > 128
                || payload.sub === '.' || payload.sub === '..'
                || /[\u0000-\u001f\u007f]/.test(payload.sub)
                || !Number.isSafeInteger(payload.iat) || payload.iat! > now
                || !Number.isSafeInteger(payload.auth_time) || (payload.auth_time as number) > now
                || (payload.auth_time as number) < 0 || payload.iat! < 0
                || !Number.isSafeInteger(payload.exp) || payload.exp! <= now) {
                throw new SubscriberAccessError(401);
            }
            if (signal.aborted) throw new SubscriberAccessError(503);
            return payload.sub;
        } catch (error) {
            if (error instanceof SubscriberAccessError) throw error;
            if (signal.aborted) throw new SubscriberAccessError(503);
            throw new SubscriberAccessError(error instanceof errors.JOSEError ? 401 : 503);
        }
    };
}
