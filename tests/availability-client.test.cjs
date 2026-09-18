const {test} = require('node:test');
const assert = require('node:assert/strict');
const {loadTypeScript} = require('./helpers/load-typescript.cjs');
const {AvailabilityAlertsImpl} = loadTypeScript('data/services/AvailabilityAlertsImpl.ts');
const {FirestoreAvailabilityEnrollment} = loadTypeScript('data/datasources/AvailabilityEnrollment.ts');
const {createAvailabilityAccessHandler} = loadTypeScript('data/server/availability/access.ts');

const device = {id: 'device-1234567890-abcd', kind: 'expo', token: 'ExpoPushToken[abcdefghijklmno12345]', country: 'IN', timeZone: 'Asia/Kolkata', updatedAt: 1000};
const flush = async () => {for (let i = 0; i < 5; i++) await new Promise(resolve => setImmediate(resolve));};
function fixture(extra = {}) {
    let account = {uid: 'alice'};
    const listeners = new Set(); const preferenceListeners = new Set(); const stored = new Map([['device', device.id]]);
    const calls = []; let enrolled = [];
    const preferences = {notifications: true, watchRegion: 'IN', streamingServices: {IN: ['tmdb:8']}};
    const options = {
        configured: true,
        auth: {getSession: () => ({ready: true, account}), getIdToken: async () => account ? `token-${account.uid}` : null,
            subscribe: callback => {listeners.add(callback); return () => listeners.delete(callback);}},
        preferences: {getPreferences: () => preferences, areNotificationsEnabled: () => preferences.notifications,
            subscribe: callback => {preferenceListeners.add(callback); return () => preferenceListeners.delete(callback);}},
        push: {supported: async () => true, register: async () => {calls.push('register'); return {kind: device.kind, token: device.token};},
            unregister: async () => {calls.push('unregister');}},
        enrollment: {read: async () => ({version: 1, devices: enrolled}), update: async (uid, token, id, value) => {
            calls.push(['update', uid, token, value]); enrolled = value ? [value] : [];
        }},
        store: {getString: key => stored.get(key), set: (key, value) => stored.set(key, value), delete: key => stored.delete(key)},
        access: async () => true, now: () => 1000, timeZone: () => 'Asia/Kolkata', ...extra,
    };
    const service = new AvailabilityAlertsImpl(options);
    return {service, options, calls, preferences, stored,
        account: value => {account = value; listeners.forEach(listener => listener());},
        preferencesChanged: () => preferenceListeners.forEach(listener => listener())};
}

test('pilot disabled: no eligibility requests, enrollment reads or permission prompts', async () => {
    const f = fixture({configured: false, access: async () => assert.fail('no network')});
    f.service.start(); await f.service.refresh('IN');
    assert.equal(await f.service.enable('IN'), false);
    assert.equal(f.service.getState().available, false); assert.deepEqual(f.calls, []);
});

test('explicit enable preserves user gesture, then verifies access and saves only this device', async () => {
    const f = fixture(); await f.service.refresh('IN');
    assert.deepEqual(f.calls, []);
    const enabling = f.service.enable('IN');
    assert.equal(f.calls[0], 'register');
    assert.equal(await enabling, true);
    assert.deepEqual(f.calls[1], ['update', 'alice', 'token-alice', device]);
    assert.equal(f.service.getState().enabled, true);
    assert.equal(await f.service.disable(), true);
    assert.equal(f.service.getState().enabled, false);
    assert.deepEqual(f.calls.slice(-2), ['unregister', ['update', 'alice', 'token-alice', null]]);
});

test('missing service choices and disabled movie notifications never prompt', async () => {
    const f = fixture(); await f.service.refresh('IN');
    f.preferences.streamingServices = {};
    assert.equal(await f.service.enable('IN'), false);
    f.preferences.streamingServices = {IN: ['tmdb:8']}; f.preferences.notifications = false;
    assert.equal(await f.service.enable('IN'), false); assert.deepEqual(f.calls, []);
});

test('eligibility lost after prompt revokes transport and does not enroll', async () => {
    const f = fixture(); await f.service.refresh('IN');
    f.options.access = async () => false;
    assert.equal(await f.service.enable('IN'), false);
    assert.deepEqual(f.calls, ['register', 'unregister']);
    assert.equal(f.service.getState().pending, false);
});

test('logout removes old registration with old identity and revokes remote transport', async () => {
    const f = fixture(); f.service.start(); await flush();
    assert.equal(await f.service.enable('IN'), true);
    f.account(null); await flush();
    assert.equal(f.service.getState().enabled, false);
    assert.equal(f.calls.at(-2), 'unregister');
    assert.deepEqual(f.calls.at(-1), ['update', 'alice', 'token-alice', null]);
});

test('signout during registration never enrolls another account', async () => {
    let finish;
    const f = fixture({push: {supported: async () => true,
        register: () => new Promise(resolve => {finish = resolve;}), unregister: async () => {}}});
    f.service.start(); await flush();
    const enabling = f.service.enable('IN'); f.account({uid: 'bob'});
    finish({kind: device.kind, token: device.token});
    assert.equal(await enabling, false);
    assert.equal(f.calls.filter(value => Array.isArray(value)).length, 0);
    assert.equal(f.service.getState().enabled, false);
});

test('master notification switch removes remote enrollment as well', async () => {
    const f = fixture(); f.service.start(); await flush(); await f.service.enable('IN');
    f.preferences.notifications = false; f.preferencesChanged(); await flush();
    assert.equal(f.service.getState().enabled, false);
    assert.deepEqual(f.calls.at(-1), ['update', 'alice', 'token-alice', null]);
});

test('lost eligibility leaves existing consent removable and master opt-out still clears it', async () => {
    const f = fixture(); f.service.start(); await flush(); await f.service.enable('IN');
    f.options.access = async () => false;
    await f.service.refresh('IN');
    assert.equal(f.service.getState().available, false);
    assert.equal(f.service.getState().enabled, true);
    f.preferences.notifications = false; f.preferencesChanged(); await flush();
    assert.equal(f.service.getState().enabled, false);
    assert.equal(f.stored.get('consent'), 'false');
    assert.deepEqual(f.calls.at(-1), ['update', 'alice', 'token-alice', null]);
});

test('refresh cleans persisted enrollment when master notifications were disabled before startup', async () => {
    const f = fixture(); await f.service.refresh('IN'); await f.service.enable('IN');
    f.preferences.notifications = false;
    f.options.access = async () => assert.fail('cleanup must not require paid eligibility');
    await f.service.refresh('IN');
    assert.equal(f.service.getState().enabled, false);
    assert.deepEqual(f.calls.at(-1), ['update', 'alice', 'token-alice', null]);
});

test('reconnection refresh retries an offline opt-out without another permission prompt', async () => {
    let refresh;
    const f = fixture({onRefresh: callback => {refresh = callback;}});
    f.service.start(); await flush(); await f.service.enable('IN');
    const update = f.options.enrollment.update;
    f.options.enrollment.update = async () => {throw new Error('offline');};
    await f.service.disable();
    f.options.enrollment.update = update;
    refresh(); await flush();
    assert.equal(f.stored.get('owner'), '');
    assert.equal(f.calls.filter(value => value === 'register').length, 1);
});

test('offline opt-out revokes push immediately and retries enrollment cleanup on refresh', async () => {
    const f = fixture(); await f.service.refresh('IN'); await f.service.enable('IN');
    const update = f.options.enrollment.update;
    f.options.enrollment.update = async () => {throw new Error('offline');};
    assert.equal(await f.service.disable(), true);
    assert.equal(f.service.getState().enabled, false);
    assert.equal(f.calls.at(-1), 'unregister');
    assert.equal(f.stored.get('owner'), 'alice');
    f.options.enrollment.update = update;
    await f.service.refresh('IN');
    assert.equal(f.service.getState().enabled, false);
    assert.equal(f.stored.get('owner'), '');
    assert.deepEqual(f.calls.at(-1), ['update', 'alice', 'token-alice', null]);
});

test('an uncertain enrollment write retains cleanup intent across a later refresh', async () => {
    const f = fixture(); await f.service.refresh('IN');
    const update = f.options.enrollment.update;
    f.options.enrollment.update = async (...args) => {if (args[3]) await update(...args); throw new Error('connection lost');};
    assert.equal(await f.service.enable('IN'), false);
    assert.equal(f.stored.get('owner'), 'alice');
    assert.equal(f.stored.get('consent'), 'false');
    f.options.enrollment.update = update;
    await f.service.refresh('IN');
    assert.equal(f.service.getState().enabled, false);
    assert.equal(f.stored.get('owner'), '');
});

test('refresh updates an enrolled device after travel without requesting permission again', async () => {
    const f = fixture(); await f.service.refresh('IN'); await f.service.enable('IN');
    f.options.timeZone = () => 'Europe/Amsterdam';
    f.options.now = () => 2000;
    f.preferences.watchRegion = null;
    await f.service.refresh('NL');
    assert.deepEqual(f.calls.at(-1), ['update', 'alice', 'token-alice', {
        ...device, country: 'NL', timeZone: 'Europe/Amsterdam', updatedAt: 2000,
    }]);
    assert.equal(f.calls.filter(value => value === 'register').length, 1);
    const writes = f.calls.length;
    await f.service.refresh('NL');
    assert.equal(f.calls.length, writes);
});

test('failed logout cleanup prevents a different account reusing the same push identity', async () => {
    const f = fixture(); f.service.start(); await flush(); await f.service.enable('IN');
    f.options.enrollment.update = async () => {throw new Error('offline');};
    f.account({uid: 'bob'}); await flush();
    assert.equal(f.calls.at(-1), 'unregister');
    assert.equal(await f.service.enable('IN'), false);
    assert.match(f.service.getState().error, /previous account/);
});

test('Firestore CAS retry preserves another device and masks only alert enrollment', async () => {
    const writes = []; let reads = 0;
    const other = {...device, id: 'device-other123456789', token: 'ExpoPushToken[anotherabcdefghijklmno]'};
    const client = new FirestoreAvailabilityEnrollment(async (url, init) => {
        if (init.method !== 'POST') {
            reads++;
            return Response.json({updateTime: `revision-${reads}`, fields: {availabilityAlerts: {stringValue: JSON.stringify({version: 1, devices: reads > 1 ? [other] : []})}}});
        }
        writes.push(JSON.parse(init.body));
        return writes.length === 1 ? Response.json({error: {status: 'FAILED_PRECONDITION'}}, {status: 400}) : Response.json({});
    });
    await client.update('alice', 'secret', device.id, device);
    assert.equal(writes.length, 2);
    assert.deepEqual(writes[1].writes[0].updateMask.fieldPaths, ['availabilityAlerts']);
    assert.deepEqual(JSON.parse(writes[1].writes[0].update.fields.availabilityAlerts.stringValue).devices, [other, device]);
    assert.deepEqual(writes[1].writes[0].currentDocument, {updateTime: 'revision-2'});
});

test('Firestore refuses corrupt existing enrollment rather than overwriting it', async () => {
    const client = new FirestoreAvailabilityEnrollment(async (url, init) => {
        assert.notEqual(init.method, 'POST');
        return Response.json({updateTime: 'revision', fields: {availabilityAlerts: {stringValue: 'broken'}}});
    });
    await assert.rejects(client.update('alice', 'secret', device.id, device), /could not be read/);
});

test('metadata refresh cannot resurrect an enrollment removed concurrently', async () => {
    const client = new FirestoreAvailabilityEnrollment(async (url, init) => {
        assert.notEqual(init.method, 'POST');
        return Response.json({updateTime: 'revision', fields: {availabilityAlerts: {stringValue: JSON.stringify({version: 1, devices: []})}}});
    });
    await client.update('alice', 'secret', device.id, {...device, country: 'NL'}, device);
});

const env = {AVAILABILITY_ALERTS_PILOT_ENABLED: 'true', TMDB_COMMERCIAL_LICENSE_CONFIRMED: 'true',
    AVAILABILITY_ALERTS_PILOT_UIDS: 'alice', YIFY_SUBSCRIBER_FIREBASE_PROJECT_ID: 'yify-2da67'};
const request = () => new Request('https://yify.expo.app/api/availability-alerts/status', {headers: {Authorization: 'Bearer a.b.c'}});
test('status is disabled without confirmed license and performs no identity or subscription calls', async () => {
    const handle = createAvailabilityAccessHandler({environment: () => ({...env, TMDB_COMMERCIAL_LICENSE_CONFIRMED: 'false'}),
        verifyIdentity: async () => assert.fail('no identity call'), verifySubscription: async () => assert.fail('no billing call')});
    const response = await handle(request());
    assert.deepEqual(await response.json(), {enabled: false, titleLimit: 20});
    assert.match(response.headers.get('Cache-Control'), /no-store/);
});

test('only a verified allowlisted subscriber may enroll; owner is not an entitlement bypass', async () => {
    let identity = 'outsider'; let checked = 0;
    const handle = createAvailabilityAccessHandler({environment: () => env, verifyIdentity: async () => identity,
        verifySubscription: async uid => {assert.equal(uid, 'alice'); checked++;}});
    assert.equal((await (await handle(request())).json()).enabled, false); assert.equal(checked, 0);
    identity = 'alice'; assert.equal((await (await handle(request())).json()).enabled, true); assert.equal(checked, 1);
});

test('status rejects anonymous requests and fails closed on subscription verification failure', async () => {
    const handle = createAvailabilityAccessHandler({environment: () => env, verifyIdentity: async () => 'alice',
        verifySubscription: async () => {throw new Error('provider unavailable');}});
    assert.equal((await handle(new Request('https://example.com'))).status, 401);
    const response = await handle(request());
    assert.equal(response.status, 503); assert.equal((await response.json()).enabled, false);
});
