import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {setImmediate as nextTurn} from 'node:timers/promises';
import {test} from 'node:test';
import {exportJWK, generateKeyPair, SignJWT} from 'jose';

const require = createRequire(import.meta.url);
const {loadTypeScript} = require('../../../tests/helpers/load-typescript.cjs');
const {createSubscriberAuthorizer, SubscriberAccessError} = loadTypeScript('data/server/subscribers/index.ts');
const primary = await generateKeyPair('RS256');
const other = await generateKeyPair('RS256');
const key = {...await exportJWK(primary.publicKey), kid: 'google-primary', alg: 'RS256', use: 'sig'};
const rotatedKey = {...await exportJWK(other.publicKey), kid: 'google-rotated', alg: 'RS256', use: 'sig'};
const NOW = Date.parse('2026-09-12T00:00:00.000Z');
const PROJECT = 'yify-2da67';
const UID = 'firebase-user-test';
const PRODUCTS = ['prod4a474db633', 'prod3b9edb236c'];
const SECRET = 'sk_testprivatecredential0123456789';
const ENTITLEMENT = {object: 'entitlement', state: 'active', id: 'entl2b0b9c6396', lookup_key: 'remove_ads', project_id: '8b6ff243'};

async function token(claims = {}, header = {alg: 'RS256', kid: key.kid}, privateKey = primary.privateKey) {
    return new SignJWT({
        sub: UID, aud: PROJECT, iss: `https://securetoken.google.com/${PROJECT}`,
        iat: NOW / 1000 - 30, auth_time: NOW / 1000 - 60, exp: NOW / 1000 + 3600, ...claims,
    }).setProtectedHeader(header).sign(privateKey);
}

function subscription(overrides = {}) {
    return {
        object: 'subscription', id: 'sub-test', customer_id: UID, original_customer_id: '$RCAnonymousID:previous',
        product_id: PRODUCTS[0], environment: 'production', store: 'play_store', gives_access: true,
        starts_at: NOW - 86_400_000, current_period_starts_at: NOW - 86_400_000, ends_at: NOW + 86_400_000,
        status: 'active', auto_renewal_status: 'will_renew', entitlements: {object: 'list', items: [ENTITLEMENT]},
        ...overrides,
    };
}

function response(items = [subscription()], next_page = null) {
    return Response.json({object: 'list', items, next_page});
}

function request(value: string, headers = {}) {
    return new Request('https://yify.expo.app/api/subscriber-catalog/movie?id=10&uid=not-authoritative', {
        headers: {Authorization: `Bearer ${value}`, ...headers},
    });
}

function fixture(options = {}) {
    const calls: {url: URL; init: RequestInit}[] = [];
    const authorize = createSubscriberAuthorizer({
        firebaseProjectId: PROJECT, revenueCatApiKey: SECRET, revenueCatProductIds: PRODUCTS,
        now: () => NOW,
        fetch: async (url: string, init: RequestInit) => {
            calls.push({url: new URL(url), init});
            if (new URL(url).hostname === 'www.googleapis.com') return Response.json({keys: [key]}, {headers: {'Cache-Control': 'public, max-age=60'}});
            return response();
        },
        ...options,
    });
    return {authorize, calls};
}

async function denies(work: Promise<unknown>, status: number) {
    await assert.rejects(work, (error: unknown) => error instanceof SubscriberAccessError && error.status === status
        && !error.message.includes(SECRET) && !error.message.includes('https://') && !error.message.includes(UID));
}

test('a signed Firebase identity plus a current production recurring subscription grants only its verified UID', async () => {
    const {authorize, calls} = fixture();
    const result = await authorize(request(await token(), {'X-RevenueCat-App-User-Id': 'other-user'}), new AbortController().signal);
    assert.deepEqual(result, {uid: UID});
    assert.equal(calls.length, 2);
    assert.equal(calls[0].url.hostname, 'www.googleapis.com');
    assert.equal(new Headers(calls[0].init.headers).get('Authorization'), null);
    assert.equal(calls[1].url.pathname, `/v2/projects/8b6ff243/customers/${UID}/subscriptions`);
    assert.equal(calls[1].url.searchParams.get('environment'), 'production');
    assert.equal(new Headers(calls[1].init.headers).get('Authorization'), `Bearer ${SECRET}`);
    assert.ok(calls.every(call => call.init.redirect === 'manual' && call.init.cache === 'no-store' && call.init.credentials === 'omit'));
});

test('Google and RevenueCat redirects fail closed without following or forwarding credentials', async () => {
    const signed = await token();
    for (const provider of ['www.googleapis.com', 'api.revenuecat.com']) {
        for (const status of [301, 302, 303, 307, 308]) {
            const calls: {url: URL; init: RequestInit}[] = [];
            const {authorize} = fixture({fetch: async (input: string, init: RequestInit) => {
                const url = new URL(input);
                calls.push({url, init});
                assert.equal(init.redirect, 'manual');
                if (url.hostname === provider) return new Response('private redirect response', {
                    status, headers: {Location: 'https://untrusted.invalid/collect'},
                });
                assert.equal(url.hostname, 'www.googleapis.com');
                return Response.json({keys: [key]});
            }});
            await denies(authorize(request(signed), new AbortController().signal), 503);
            assert.equal(calls.length, provider === 'www.googleapis.com' ? 1 : 2);
            assert.ok(calls.every(call => ['www.googleapis.com', 'api.revenuecat.com'].includes(call.url.hostname)));
            for (const call of calls) {
                assert.equal(new Headers(call.init.headers).get('Authorization'), call.url.hostname === 'api.revenuecat.com' ? `Bearer ${SECRET}` : null);
            }
        }
    }
});

test('missing, malformed, unsigned and unexpected-algorithm tokens fail before any provider lookup', async () => {
    const {authorize, calls} = fixture();
    for (const header of [null, 'Basic abc', 'Bearer bad-token', 'Bearer a.b.', `Bearer ${'x'.repeat(17000)}`]) {
        const req = new Request('https://yify.expo.app/api/subscriber-catalog/movie', {headers: header === null ? {} : {Authorization: header}});
        await denies(authorize(req, new AbortController().signal), 401);
    }
    const symmetric = await new SignJWT({sub: UID}).setProtectedHeader({alg: 'HS256', kid: key.kid}).sign(new Uint8Array(32).fill(1));
    await denies(authorize(request(symmetric), new AbortController().signal), 401);
    assert.equal(calls.length, 0);
});

test('invalid signature, issuer, audience, dates and subject cannot authorize a RevenueCat lookup', async () => {
    const {authorize, calls} = fixture();
    const invalid = [
        token({}, {alg: 'RS256', kid: key.kid}, other.privateKey),
        token({iss: 'https://securetoken.google.com/other-project'}), token({aud: 'other-project'}),
        token({aud: [PROJECT, 'other-project']}), token({exp: NOW / 1000}),
        token({iat: NOW / 1000 + 1}), token({auth_time: NOW / 1000 + 1}), token({auth_time: undefined}),
        token({auth_time: -1}), token({sub: ''}), token({sub: 'x'.repeat(129)}), token({sub: 'invalid\nsubject'}),
        token({sub: '.'}), token({sub: '..'}),
    ];
    for (const value of invalid) await denies(authorize(request(await value), new AbortController().signal), 401);
    assert.ok(calls.every(call => call.url.hostname === 'www.googleapis.com'));
    assert.equal(calls.length, 1);
});

test('missing or invalid server configuration cannot fall back to client-visible credentials', async () => {
    for (const options of [{firebaseProjectId: ''}, {revenueCatApiKey: ''}, {revenueCatApiKey: 'goog_public-sdk-key'},
        {revenueCatProductIds: []}, {revenueCatProductIds: ['remove_ads_lifetime']}, {firebaseProjectId: 'https://evil.invalid'}]) {
        const {authorize, calls} = fixture(options);
        await denies(authorize(request(await token()), new AbortController().signal), 503);
        assert.equal(calls.length, 0);
    }
});

test('cancelled-but-unexpired, web recurring and active grace-period subscriptions remain eligible', async () => {
    for (const value of [
        subscription({auto_renewal_status: 'will_not_renew'}),
        subscription({product_id: PRODUCTS[1], store: 'rc_billing'}),
        subscription({status: 'in_grace_period', ends_at: NOW - 1000, gives_access: true}),
    ]) {
        const {authorize} = fixture({fetch: async (url: string) => new URL(url).hostname === 'www.googleapis.com'
            ? Response.json({keys: [key]}) : response([value])});
        assert.deepEqual(await authorize(request(await token()), new AbortController().signal), {uid: UID});
    }
});

test('lifetime, sandbox, promotional, expired, refunded and unrelated grants are rejected', async () => {
    const invalid = [
        subscription({product_id: 'prod-lifetime', ends_at: null}), subscription({environment: 'sandbox'}),
        subscription({store: 'promotional'}), subscription({product_id: null}), subscription({gives_access: false}),
        subscription({ends_at: NOW - 1}), subscription({status: 'expired'}), subscription({status: 'paused'}),
        subscription({status: 'in_billing_retry'}), subscription({starts_at: NOW + 1000}),
        subscription({entitlements: {object: 'list', items: [{...ENTITLEMENT, lookup_key: 'other'}]}}),
        subscription({entitlements: {object: 'list', items: [{...ENTITLEMENT, id: 'other'}]}}),
        subscription({entitlements: {object: 'list', items: [{...ENTITLEMENT, project_id: 'other'}]}}),
        subscription({entitlements: {object: 'list', items: [{...ENTITLEMENT, state: 'archived'}]}}),
    ];
    for (const value of invalid) {
        const {authorize} = fixture({fetch: async (url: string) => new URL(url).hostname === 'www.googleapis.com'
            ? Response.json({keys: [key]}) : response([value])});
        await denies(authorize(request(await token()), new AbortController().signal), 403);
    }
});

test('a previous successful subscriber lookup is never reused for another UID or a later expiry', async () => {
    let access = true;
    const customers: string[] = [];
    const {authorize} = fixture({fetch: async (input: string) => {
        const url = new URL(input);
        if (url.hostname === 'www.googleapis.com') return Response.json({keys: [key]}, {headers: {'Cache-Control': 'max-age=60'}});
        customers.push(url.pathname);
        return response(access ? [subscription()] : []);
    }});
    await authorize(request(await token()), new AbortController().signal);
    access = false;
    await denies(authorize(request(await token({sub: 'different-firebase-user'})), new AbortController().signal), 403);
    await denies(authorize(request(await token()), new AbortController().signal), 403);
    assert.equal(customers.length, 3);
    assert.ok(customers[1].includes('/different-firebase-user/'));
});

test('RevenueCat errors and malformed responses are generic and fail closed', async () => {
    for (const [status, body, expected] of [[404, {}, 403], [401, {secret: SECRET}, 503], [403, {}, 503], [429, {}, 503], [500, {}, 503], [200, {object: 'list', items: 'bad'}, 503]]) {
        const {authorize} = fixture({fetch: async (url: string) => new URL(url).hostname === 'www.googleapis.com'
            ? Response.json({keys: [key]}) : Response.json(body, {status})});
        await denies(authorize(request(await token()), new AbortController().signal), expected);
    }
});

test('pagination uses only validated same-customer cursors and can locate a later active subscription', async () => {
    let pages = 0;
    const {authorize} = fixture({fetch: async (input: string) => {
        const url = new URL(input);
        if (url.hostname === 'www.googleapis.com') return Response.json({keys: [key]});
        pages++;
        if (pages === 1) return response([], `/v2/projects/8b6ff243/customers/${UID}/subscriptions?starting_after=subnext`);
        assert.equal(url.searchParams.get('starting_after'), 'subnext');
        assert.equal(url.searchParams.get('environment'), 'production');
        return response();
    }});
    await authorize(request(await token()), new AbortController().signal);
    assert.equal(pages, 2);
    let rcCalls = 0;
    const malicious = fixture({fetch: async (url: string) => {
        if (new URL(url).hostname === 'www.googleapis.com') return Response.json({keys: [key]});
        rcCalls++;
        return response([], 'https://evil.invalid/collect?starting_after=subnext');
    }});
    await denies(malicious.authorize(request(await token()), new AbortController().signal), 503);
    assert.equal(rcCalls, 1);
});

test('public signing-key cache honors max-age and rotates without sharing customer authorization', async () => {
    let now = NOW;
    let keyReads = 0;
    const {authorize} = fixture({now: () => now, fetch: async (url: string) => {
        if (new URL(url).hostname !== 'www.googleapis.com') return response();
        keyReads++;
        return Response.json({keys: keyReads === 1 ? [key] : [rotatedKey]}, {headers: {'Cache-Control': 'max-age=60'}});
    }});
    await authorize(request(await token()), new AbortController().signal);
    await authorize(request(await token()), new AbortController().signal);
    assert.equal(keyReads, 1);
    now += 31_000;
    await authorize(request(await token({}, {alg: 'RS256', kid: rotatedKey.kid}, other.privateKey)), new AbortController().signal);
    assert.equal(keyReads, 2);
});

test('aborted or timed-out verification cancels provider fetch and never returns access', async () => {
    for (const cancelCaller of [true, false]) {
        const controller = new AbortController();
        let seenSignal: AbortSignal | undefined;
        let started: () => void = () => {};
        const ready = new Promise<void>(resolve => { started = resolve; });
        const {authorize} = fixture({timeoutMs: cancelCaller ? 1000 : 5, fetch: (_url: string, init: RequestInit) => new Promise((_, reject) => {
            seenSignal = init.signal!;
            seenSignal.addEventListener('abort', () => reject(new Error('private failed request')), {once: true});
            started();
        })});
        const work = authorize(request(await token()), controller.signal);
        await ready;
        if (cancelCaller) controller.abort();
        await denies(work, 503);
        assert.equal(seenSignal?.aborted, true);
    }
});

test('one aborted JWKS fetch cannot cancel another caller’s verification', async () => {
    const firstCaller = new AbortController();
    const keys: {signal: AbortSignal; resolve: (value: Response) => void}[] = [];
    const {authorize} = fixture({fetch: (url: string, init: RequestInit) => {
        if (new URL(url).hostname !== 'www.googleapis.com') return Promise.resolve(response());
        return new Promise<Response>((resolve, reject) => {
            keys.push({signal: init.signal!, resolve});
            init.signal!.addEventListener('abort', () => reject(new Error('Aborted')), {once: true});
        });
    }});
    const signed = await token();
    const first = authorize(request(signed), firstCaller.signal);
    const second = authorize(request(signed), new AbortController().signal);
    await nextTurn();
    assert.equal(keys.length, 2);
    firstCaller.abort();
    await denies(first, 503);
    assert.equal(keys[1].signal.aborted, false);
    keys[1].resolve(Response.json({keys: [key]}));
    assert.deepEqual(await second, {uid: UID});
});

test('signing-key outages, malformed keysets and oversized responses never reach RevenueCat', async () => {
    for (const reply of [
        () => Response.json({private: SECRET}, {status: 503}),
        () => Response.json({keys: []}),
        () => Response.json({keys: [{...key, use: 'enc'}]}),
        () => new Response('invalid JSON'),
        () => new Response('x'.repeat(128_001)),
    ]) {
        let calls = 0;
        const {authorize} = fixture({fetch: async (url: string) => {
            calls++;
            assert.equal(new URL(url).hostname, 'www.googleapis.com');
            return reply();
        }});
        await denies(authorize(request(await token()), new AbortController().signal), 503);
        assert.equal(calls, 1);
    }
});

test('unknown signing keys are denied, while cache Age reduces the allowed refresh interval', async () => {
    let now = NOW;
    let keyReads = 0;
    let subscriberReads = 0;
    const {authorize} = fixture({now: () => now, fetch: async (url: string) => {
        if (new URL(url).hostname !== 'www.googleapis.com') { subscriberReads++; return response(); }
        keyReads++;
        return Response.json({keys: [key]}, {headers: {'Cache-Control': 'max-age=60', Age: '59'}});
    }});
    await denies(authorize(request(await token({}, {alg: 'RS256', kid: 'unknown'})), new AbortController().signal), 401);
    assert.equal(subscriberReads, 0);
    await authorize(request(await token()), new AbortController().signal);
    assert.equal(keyReads, 1);
    now += 2000;
    await authorize(request(await token()), new AbortController().signal);
    assert.equal(keyReads, 2);
});

test('caller cancellation reaches the RevenueCat lookup after successful Firebase verification', async () => {
    const controller = new AbortController();
    let ready: () => void = () => {};
    const started = new Promise<void>(resolve => { ready = resolve; });
    let subscriptionSignal: AbortSignal | undefined;
    const {authorize} = fixture({fetch: (url: string, init: RequestInit) => {
        if (new URL(url).hostname === 'www.googleapis.com') return Promise.resolve(Response.json({keys: [key]}));
        return new Promise((_, reject) => {
            subscriptionSignal = init.signal!;
            subscriptionSignal.addEventListener('abort', () => reject(new Error('private customer response')), {once: true});
            ready();
        });
    }});
    const work = authorize(request(await token()), controller.signal);
    await started;
    controller.abort();
    await denies(work, 503);
    assert.equal(subscriptionSignal?.aborted, true);
});
