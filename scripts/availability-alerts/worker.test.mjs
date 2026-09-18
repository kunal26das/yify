import assert from 'node:assert/strict';
import test from 'node:test';
import {pilotConfig, runPilot} from './worker.mjs';
import {demonstrate, fixtureAccount, fixtureDevice, memoryStore} from './simulation.mjs';
import {firestoreStore, pushTransport, revenueCatVerifier, tmdbCatalog} from './adapters.mjs';
import {alertContext, planAvailability} from '../../domain/availability/pilot.ts';

const instant = Date.parse('2026-09-19T14:30:00Z');
function setup() {
    const store = memoryStore(); let available = false; let sends = 0;
    const options = {uids: ['test'], store, now: () => instant, dryRun: false, verifySubscription: async () => true,
        catalog: {observe: async () => ({country: 'IN', status: 'ready', offers: available ? [{serviceId: 'tmdb:8', type: 'subscription'}] : []})},
        transport: {send: async () => {sends++; return {status: 'accepted'};}}};
    return {options, store, available() {available = true;}, sends: () => sends};
}

test('live pilot requires both exact opt-in flags and a bounded explicit user allowlist', () => {
    const env = {AVAILABILITY_ALERTS_PILOT_ENABLED: 'true', TMDB_COMMERCIAL_LICENSE_CONFIRMED: 'true', AVAILABILITY_ALERTS_PILOT_UIDS: 'one,two'};
    assert.deepEqual(pilotConfig(env).uids, ['one', 'two']);
    for (const bad of [{}, {...env, TMDB_COMMERCIAL_LICENSE_CONFIRMED: ''}, {...env, AVAILABILITY_ALERTS_PILOT_ENABLED: '1'},
        {...env, AVAILABILITY_ALERTS_PILOT_UIDS: '_cache'}, {...env, AVAILABILITY_ALERTS_PILOT_UIDS: ''},
        {...env, AVAILABILITY_ALERTS_PILOT_UIDS: Array.from({length: 21}, (_, n) => `u${n}`).join(',')}]) assert.throws(() => pilotConfig(bad));
});
test('offline scenario demonstrates baseline, gain and dedup without any external requests', async () => {
    assert.deepEqual(await demonstrate(), {baseline: 0, newlyAvailable: 1, repeated: 0, mockDeliveries: 1, externalRequests: 0});
});
test('dry run never invokes the transport', async () => {
    const s = setup(); await runPilot(s.options); s.available();
    const result = await runPilot({...s.options, dryRun: true});
    assert.equal(result.planned, 1); assert.equal(s.sends(), 0);
});
test('missing, expired, canceled or unverifiable subscription cannot send or retain pending events', async () => {
    for (const verifier of [async () => false, async () => {throw new Error('timeout');}]) {
        const s = setup(); await runPilot(s.options); s.available();
        await runPilot({...s.options, verifySubscription: verifier}); assert.equal(s.sends(), 0);
    }
});
test('removed accounts and opt-outs clean up state, and malformed enrollment fails closed', async () => {
    for (const account of [null, {...fixtureAccount(), availabilityAlerts: JSON.stringify({version: 1, devices: []})},
        {...fixtureAccount(), availabilityAlerts: '{'}]) {
        const s = setup(); await runPilot(s.options); s.available(); s.store.setAccount(account);
        await runPilot(s.options); assert.equal(s.sends(), 0);
        if (!account) assert.equal(await s.store.readState('test'), null);
        else assert.deepEqual(JSON.parse((await s.store.readState('test')).data.payload).devices, {});
    }
});
test('pre-send recheck catches opt-outs, watchlist changes and a subscription canceled during the run', async () => {
    for (const change of ['optout', 'removed', 'subscription']) {
        const s = setup(); await runPilot(s.options); s.available();
        const observe = s.options.catalog.observe; let checks = 0;
        s.options.catalog.observe = async (...args) => {
            if (change !== 'subscription') s.store.setAccount({...fixtureAccount(), ...(change === 'optout'
                ? {availabilityAlerts: JSON.stringify({version: 1, devices: []})} : {watchlist: JSON.stringify({items: []})})});
            return observe(...args);
        };
        if (change === 'subscription') s.options.verifySubscription = async () => ++checks === 1;
        await runPilot(s.options); assert.equal(s.sends(), 0);
    }
});
test('concurrent jobs compete for a CAS lease, so only one sends', async () => {
    const s = setup(); await runPilot(s.options); s.available();
    await Promise.all([runPilot(s.options), runPilot(s.options)]); assert.equal(s.sends(), 1);
});
test('quiet hours postpone pending events without consuming the daily attempt', async () => {
    const s = setup(); await runPilot(s.options); s.available();
    const early = {...s.options, now: () => Date.parse('2026-09-19T10:00:00Z')};
    await runPilot(early); assert.equal(s.sends(), 0);
    const state = JSON.parse((await s.store.readState('test')).data.payload).devices[fixtureDevice.id];
    assert.equal(state.attemptedDay, undefined); assert.equal(state.pending.length, 1);
    await runPilot(s.options); assert.equal(s.sends(), 1);
});
test('ambiguous provider failure is recorded as unknown and event IDs are not resent', async () => {
    const s = setup(); await runPilot(s.options); s.available(); let sends = 0;
    s.options.transport.send = async () => {sends++; throw new Error('network_timeout');};
    assert.equal((await runPilot(s.options)).unknown, 1);
    await runPilot({...s.options, now: () => instant + 86_400_000}); assert.equal(sends, 1);
    assert.equal(JSON.parse((await s.store.readState('test')).data.payload).devices[fixtureDevice.id].attempt.status, 'unknown');
});
test('provider rejection retries the next day but invalid tokens stay disabled until refreshed', async () => {
    for (const invalidToken of [false, true]) {
        const s = setup(); await runPilot(s.options); s.available(); let sends = 0;
        s.options.transport.send = async () => {sends++; return {status: 'failed', invalidToken};};
        await runPilot(s.options); await runPilot(s.options); assert.equal(sends, 1);
        await runPilot({...s.options, now: () => instant + 86_400_000}); assert.equal(sends, invalidToken ? 1 : 2);
    }
});

test('an old Expo receipt cannot disable a refreshed device token', async () => {
    const s = setup(); await runPilot(s.options); s.available();
    s.options.transport.send = async () => ({status: 'accepted', receiptId: 'old-ticket'});
    await runPilot(s.options);
    const refreshed = {...fixtureDevice, token: 'ExponentPushToken[newfixture123456789]', updatedAt: instant};
    s.store.setAccount({...fixtureAccount(), availabilityAlerts: JSON.stringify({version: 1, devices: [refreshed]})});
    s.options.transport.receipt = async () => ({invalidToken: true, ok: false});
    const result = await runPilot({...s.options, now: () => instant + 60 * 60_000});
    assert.equal(result.observations, 1); // Refresh remains eligible for normal processing.
    const state = JSON.parse((await s.store.readState('test')).data.payload).devices[fixtureDevice.id];
    assert.ok(state.disabledTokenHash);
    assert.equal(state.attempt.receiptId, undefined);
});

test('same-day second gain remains pending and is sent on the next eligible local day', async () => {
    const s = setup(); await runPilot(s.options); s.available(); await runPilot(s.options);
    const original = s.options.catalog.observe;
    s.options.catalog.observe = async () => ({country: 'IN', status: 'ready', offers: []});
    await runPilot(s.options);
    s.options.catalog.observe = original;
    await runPilot(s.options); assert.equal(s.sends(), 1);
    await runPilot({...s.options, now: () => instant + 86_400_000}); assert.equal(s.sends(), 2);
});

const reply = (value, status = 200) => new Response(JSON.stringify(value), {status, headers: {'Content-Type': 'application/json'}});
const subscription = overrides => ({object: 'subscription', environment: 'production', gives_access: true, product_id: 'prod12345',
    store: 'play_store', status: 'active', starts_at: instant - 1000, current_period_starts_at: instant - 1000, ends_at: instant + 1000,
    entitlements: {object: 'list', items: [{object: 'entitlement', state: 'active', id: 'entl2b0b9c6396', lookup_key: 'remove_ads', project_id: '8b6ff243'}]}, ...overrides});
test('RevenueCat verifier admits only production recurring products with the correct active entitlement', async () => {
    for (const [overrides, expected] of [[{}, true], [{environment: 'sandbox'}, false], [{product_id: 'prodlifetime'}, false],
        [{status: 'canceled'}, false], [{gives_access: false}, false], [{ends_at: instant - 1}, false],
        [{status: 'in_grace_period', ends_at: instant - 1}, true], [{entitlements: {object: 'list', items: []}}, false]]) {
        const verify = revenueCatVerifier('secret', ['prod12345'], async () => reply({object: 'list', items: [subscription(overrides)], next_page: null}), () => instant);
        assert.equal(await verify('test'), expected);
    }
});
test('RevenueCat errors and foreign pagination never produce an entitlement', async () => {
    const error = revenueCatVerifier('secret', ['prod12345'], async () => reply({}, 503));
    await assert.rejects(error('test'));
    const foreign = revenueCatVerifier('secret', ['prod12345'], async () => reply({object: 'list', items: [], next_page: 'https://evil.example/?starting_after=x'}));
    await assert.rejects(foreign('test'));
});
test('TMDB cache shares successful lookups within a day and excludes rentals and other countries', async () => {
    let requests = 0;
    const catalog = tmdbCatalog('secret', {}, async url => {
        requests++;
        if (url.includes('/regions')) return reply({results: [{iso_3166_1: 'IN'}]});
        if (url.includes('/find/')) return reply({movie_results: [{id: 5}]});
        return reply({results: {IN: {rent: [{provider_id: 8}]}, US: {flatrate: [{provider_id: 8}]}}});
    }, () => instant, 0);
    const movie = {id: 1, imdbCode: 'tt1234567'};
    assert.deepEqual((await catalog.observe(movie, 'IN')).offers, []);
    await catalog.observe(movie, 'IN'); assert.equal(requests, 3);
    assert.equal((await catalog.observe(movie, 'ZZ')).status, 'unavailable');
});
test('TMDB malformed responses and outages remain unavailable and never cache a false empty result', async () => {
    const catalog = tmdbCatalog('secret', {day: '2026-09-19', regions: ['IN'], entries: {}},
        async () => reply({}, 503), () => instant, 0);
    assert.equal((await catalog.observe({id: 1, imdbCode: 'tt1234567'}, 'IN')).status, 'unavailable');
    assert.deepEqual(catalog.cache.entries, {});
});

test('explicit null TMDB country/provider data cannot turn an available title into a false new-availability alert', async () => {
    const movie = {id: 1, imdbCode: 'tt1234567'};
    const context = alertContext(fixtureAccount(), fixtureDevice);
    for (const malformed of [null, {flatrate: null}, {free: null}, {ads: null}]) {
        let provider = {flatrate: [{provider_id: 8}]};
        const fetcher = async url => url.includes('/find/') ? reply({movie_results: [{id: 5}]}) : reply({results: {IN: provider}});
        const createCatalog = () => tmdbCatalog('secret', {day: '2026-09-19', regions: ['IN'], entries: {}}, fetcher, () => instant, 0);
        const first = await createCatalog().observe(movie, 'IN');
        const baseline = planAvailability(context, undefined, {[movie.imdbCode]: first}, instant).state;
        provider = malformed;
        const brokenCatalog = createCatalog();
        const broken = await brokenCatalog.observe(movie, 'IN');
        assert.equal(broken.status, 'unavailable'); assert.deepEqual(brokenCatalog.cache.entries, {});
        const preserved = planAvailability(context, baseline, {[movie.imdbCode]: broken}, instant + 1).state;
        provider = {flatrate: [{provider_id: 8}]};
        const recovered = await createCatalog().observe(movie, 'IN');
        assert.equal(planAvailability(context, preserved, {[movie.imdbCode]: recovered}, instant + 2).deliverable.length, 0);
    }
});
test('transport sends data-only FCM messages and registers the native channel and receipt', async () => {
    const calls = [];
    const transport = pushTransport('test-project', 'short-token', '', async (url, init) => {
        calls.push({url, body: JSON.parse(init.body)});
        return url.includes('fcm.googleapis') ? reply({name: 'accepted'}) : reply({data: {status: 'ok', id: 'receipt'}});
    });
    const payload = {title: 'Ready', body: 'Saved movie', data: {kind: 'availability', eventId: 'abc123', title: 'Ready', body: 'Saved movie', path: '/watchlist'}};
    assert.equal((await transport.send({...fixtureDevice, kind: 'fcm'}, payload)).status, 'accepted');
    assert.equal(calls[0].body.message.notification, undefined); assert.equal(calls[0].body.message.webpush.notification, undefined);
    assert.equal((await transport.send(fixtureDevice, payload)).receiptId, 'receipt');
    assert.equal(calls[1].body.channelId, 'availability-alerts');
});

test('server errors from push gateways are ambiguous and cannot be treated as a safe retry', async () => {
    const transport = pushTransport('test-project', 'token', '', async () => reply({}, 503));
    const payload = {title: 'Ready', body: 'Saved', data: {eventId: 'abc123'}};
    await assert.rejects(transport.send(fixtureDevice, payload));
    await assert.rejects(transport.send({...fixtureDevice, kind: 'fcm'}, payload));
});
test('Firestore writes use updateTime preconditions and cannot overwrite another worker lease', async () => {
    let request;
    const store = firestoreStore('test-project', 'short-token', async (url, init) => {
        request = {url: String(url), body: JSON.parse(init.body)}; return reply({error: {status: 'FAILED_PRECONDITION'}}, 400);
    });
    assert.equal(await store.writeState('test', {payload: '{}'}, 'version1'), null);
    assert.equal(new URL(request.url).searchParams.get('currentDocument.updateTime'), 'version1');
});
