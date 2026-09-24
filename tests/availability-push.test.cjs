const assert = require('node:assert/strict');
const {test} = require('node:test');
const {loadTypeScript} = require('./helpers/load-typescript.cjs');

const PROJECT = '130cfded-cef0-49b3-94a4-82d3a3852ef5';

function mutableExports(values) {
    return Object.defineProperties({}, Object.fromEntries(Object.keys(values).map(key => [key, {
        enumerable: true,
        get: () => values[key],
        set: value => {values[key] = value;},
    }])));
}

function nativeFixture({platform = 'android', project = PROJECT, permission = 'granted', canAskAgain = true, iosStatus} = {}) {
    const calls = [];
    let revoke;
    let token = 'ExponentPushToken[test_token]';
    let result = {status: permission, granted: permission === 'granted', canAskAgain, ios: {status: iosStatus}};
    const notifications = mutableExports({
        AndroidImportance: {DEFAULT: 3}, IosAuthorizationStatus: {PROVISIONAL: 3, EPHEMERAL: 4},
        async setNotificationChannelAsync(...args) {calls.push(['channel', ...args]);},
        async getPermissionsAsync() {calls.push(['permission']); return result;},
        async requestPermissionsAsync() {calls.push(['request']); return result;},
        async getExpoPushTokenAsync(options) {calls.push(['token', options]); return {data: token};},
        async setAutoServerRegistrationEnabledAsync(value) {calls.push(['auto', value]);},
        async unregisterForNotificationsAsync() {calls.push(['revoke']); if (revoke) await revoke();},
    });
    const {AvailabilityPushImpl} = loadTypeScript('data/services/AvailabilityPush.ts', {
        'expo-constants': {easConfig: {projectId: project}},
        'react-native': {Platform: {OS: platform}}, 'expo-notifications': notifications,
    });
    return {push: new AvailabilityPushImpl(), calls, notifications, setToken: value => {token = value;},
        setPermission: value => {result = value;}, onRevoke: callback => {revoke = callback;}};
}

function setGlobal(t, name, value) {
    const original = Object.getOwnPropertyDescriptor(globalThis, name);
    Object.defineProperty(globalThis, name, {value, writable: true, configurable: true});
    t.after(() => original ? Object.defineProperty(globalThis, name, original) : delete globalThis[name]);
}

function webFixture(t, {permission = 'granted', permissionResult = 'granted', secure = true, vapid = 'B'.repeat(87), base = '', firebaseSupported = true} = {}) {
    const calls = [];
    const original = process.env.EXPO_PUBLIC_FIREBASE_VAPID_KEY;
    if (vapid) process.env.EXPO_PUBLIC_FIREBASE_VAPID_KEY = vapid; else delete process.env.EXPO_PUBLIC_FIREBASE_VAPID_KEY;
    t.after(() => original === undefined ? delete process.env.EXPO_PUBLIC_FIREBASE_VAPID_KEY : process.env.EXPO_PUBLIC_FIREBASE_VAPID_KEY = original);
    const script = `https://yify.example${base}/availability-worker.js`;
    const scope = `https://yify.example${base}/availability-push/`;
    let existing;
    let revoke;
    const registration = {
        scope, active: {scriptURL: script},
        pushManager: {async getSubscription() {return {async unsubscribe() {calls.push(['unsubscribe']); return true;}};}},
        async getNotifications() {return [{tag: 'yify-availability:old', close() {calls.push(['close']);}}, {tag: 'other', close() {calls.push(['close.other']);}}];},
        async unregister() {calls.push(['unregister']); existing = undefined; return true;},
    };
    setGlobal(t, 'window', {isSecureContext: secure, location: {origin: 'https://yify.example'}});
    setGlobal(t, 'navigator', {serviceWorker: {
        async getRegistration(url) {calls.push(['find', url]); return existing;},
        async register(...args) {calls.push(['worker', ...args]); existing = registration; return registration;},
    }});
    setGlobal(t, 'PushManager', class {});
    setGlobal(t, 'Notification', {permission, requestPermission() {calls.push(['request']); return Promise.resolve(permissionResult);}});
    const firebase = mutableExports({
        async isSupported() {calls.push(['supported']); return firebaseSupported;},
        getMessaging() {calls.push(['messaging']); return {};},
        async getToken(_messaging, options) {calls.push(['token', options]); return 'fcm:token_abcdefghijklmnop';},
        async deleteToken() {calls.push(['delete']); if (revoke) await revoke(); return true;},
    });
    const {AvailabilityPushImpl} = loadTypeScript('data/services/AvailabilityPush.web.ts', {
        'expo-constants': {expoConfig: {experiments: {baseUrl: base}}},
        'firebase/messaging': firebase,
        '../datasources/firebase/FirebaseWebApp': {getFirebaseApp() {calls.push(['app']); return {}; }},
    });
    return {push: new AvailabilityPushImpl(), makePush: () => new AvailabilityPushImpl(), calls, registration, firebase,
        setExisting: value => {existing = value;}, onRevoke: callback => {revoke = callback;}};
}

test('native support checks do not prompt or fetch a token; explicit registration creates the Android channel', async () => {
    const f = nativeFixture();
    assert.equal(await f.push.supported(), true);
    assert.deepEqual(f.calls, []);
    assert.deepEqual(await f.push.register(), {kind: 'expo', token: 'ExponentPushToken[test_token]'});
    assert.equal(f.calls[0][0], 'channel');
    assert.equal(f.calls[0][1], 'availability-alerts');
    assert.deepEqual(f.calls.find(value => value[0] === 'token')[1], {projectId: PROJECT});
    assert.equal(f.calls.some(value => value[0] === 'request'), false);
});

test('native permission denial never registers a token and missing project never prompts', async () => {
    for (const canAskAgain of [true, false]) {
        const f = nativeFixture({permission: 'denied', canAskAgain});
        await assert.rejects(f.push.register(), /Allow notifications/);
        assert.equal(f.calls.some(value => value[0] === 'token'), false);
        assert.equal(f.calls.some(value => value[0] === 'request'), canAskAgain);
    }
    const f = nativeFixture({project: ''});
    assert.equal(await f.push.supported(), false);
    await assert.rejects(f.push.register(), /not supported/);
    assert.deepEqual(f.calls, []);
});

test('iOS provisional authorization works without prompting; SDK token details never escape failed registration', async () => {
    const f = nativeFixture({platform: 'ios', permission: 'undetermined', canAskAgain: false, iosStatus: 3});
    await f.push.register();
    assert.deepEqual(f.calls.map(value => value[0]), ['permission', 'token', 'auto']);
    assert.deepEqual(f.calls.at(-1), ['auto', true]);
    f.notifications.getExpoPushTokenAsync = async () => {throw new Error('sensitive token response');};
    await assert.rejects(f.push.register(), error => error.message === 'Availability notifications could not be registered.');
});

test('native revocation disables Expo renewal first and serializes the next registration without cancelling local reminders', async () => {
    const f = nativeFixture();
    let finish;
    f.onRevoke(() => new Promise(resolve => {finish = resolve;}));
    const unregister = f.push.unregister();
    const register = f.push.register();
    await new Promise(resolve => setImmediate(resolve));
    assert.deepEqual(f.calls, [['auto', false], ['revoke']]);
    finish();
    await unregister;
    await register;
    assert.equal(f.calls.filter(value => value[0] === 'token').length, 1);
    assert.deepEqual(f.calls.at(-1), ['auto', true]);
});

test('failed native revocation must succeed on retry before another token can register', async () => {
    const f = nativeFixture();
    f.onRevoke(async () => {throw new Error('offline');});
    await assert.rejects(f.push.unregister(), /could not be disabled/);
    await assert.rejects(f.push.register(), /could not be disabled/);
    assert.equal(f.calls.some(value => value[0] === 'token'), false);
    f.onRevoke(undefined);
    await f.push.register();
});

test('web support probing never requests permission or creates a token', async t => {
    const f = webFixture(t, {permission: 'default'});
    assert.equal(await f.push.supported(), true);
    assert.deepEqual(f.calls, [['supported']]);
});

test('web requests permission synchronously before asynchronous imports or worker registration', async t => {
    const f = webFixture(t, {permission: 'default'});
    const result = f.push.register();
    assert.deepEqual(f.calls, [['request']]);
    assert.equal((await result).kind, 'fcm');
    const worker = f.calls.find(value => value[0] === 'worker');
    assert.deepEqual(worker, ['worker', 'https://yify.example/availability-worker.js', {scope: 'https://yify.example/availability-push/'}]);
    const options = f.calls.find(value => value[0] === 'token')[1];
    assert.equal(options.vapidKey, 'B'.repeat(87));
    assert.equal(options.serviceWorkerRegistration, f.registration);
});

test('web denied permission never creates a worker or token', async t => {
    const f = webFixture(t, {permission: 'denied'});
    await assert.rejects(f.push.register(), /Allow notifications/);
    assert.deepEqual(f.calls, []);
});

test('web dismissed permission prompt never creates a worker or token', async t => {
    const f = webFixture(t, {permission: 'default', permissionResult: 'default'});
    await assert.rejects(f.push.register(), /Allow notifications/);
    assert.deepEqual(f.calls, [['request']]);
});

test('web missing VAPID key fails before prompting', async t => {
    const f = webFixture(t, {permission: 'default', vapid: ''});
    assert.equal(await f.push.supported(), false);
    await assert.rejects(f.push.register(), /not supported/);
    assert.deepEqual(f.calls, []);
});

test('web insecure contexts fail before prompting', async t => {
    const f = webFixture(t, {permission: 'default', secure: false});
    assert.equal(await f.push.supported(), false);
    await assert.rejects(f.push.register(), /not supported/);
    assert.deepEqual(f.calls, []);
});

test('web Firebase unsupported browsers cannot register', async t => {
    const f = webFixture(t, {firebaseSupported: false});
    assert.equal(await f.push.supported(), false);
    await assert.rejects(f.push.register(), /not supported/);
    assert.equal(f.calls.some(value => value[0] === 'token'), false);
});

test('web uses the exported GitHub Pages base path and never overwrites another worker', async t => {
    const f = webFixture(t, {base: '/yify'});
    await f.push.register();
    assert.deepEqual(f.calls.find(value => value[0] === 'worker'), ['worker', 'https://yify.example/yify/availability-worker.js', {scope: 'https://yify.example/yify/availability-push/'}]);
    f.setExisting({...f.registration, active: {scriptURL: 'https://yify.example/yify/other-worker.js'}});
    const before = f.calls.length;
    await assert.rejects(f.push.register(), /could not be registered/);
    await f.push.unregister();
    assert.equal(f.calls.slice(before).some(value => ['worker', 'delete', 'unsubscribe', 'unregister'].includes(value[0])), false);
});

test('web revokes its Firebase token and push subscription before a queued registration', async t => {
    const f = webFixture(t);
    await f.push.register();
    f.calls.length = 0;
    let finish;
    f.onRevoke(() => new Promise(resolve => {finish = resolve;}));
    const off = f.push.unregister();
    const on = f.push.register();
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(f.calls.some(value => value[0] === 'token'), false);
    finish();
    await off;
    await on;
    assert.ok(f.calls.findIndex(value => value[0] === 'unsubscribe') < f.calls.findIndex(value => value[0] === 'token'));
    assert.equal(f.calls.some(value => value[0] === 'close.other'), false);
});

test('fresh-page web unregister unsubscribes its own transport without registering a default Firebase worker or prompting', async t => {
    const f = webFixture(t, {permission: 'default'});
    f.setExisting(f.registration);
    await f.makePush().unregister();
    assert.deepEqual(f.calls.map(value => value[0]), ['find', 'unsubscribe', 'close', 'unregister']);
});

test('native partially failed registration revokes the remote token and prevents token details escaping', async () => {
    const f = nativeFixture();
    f.notifications.getExpoPushTokenAsync = async () => {throw new Error('sensitive token response');};
    await assert.rejects(f.push.register(), error => error.message === 'Availability notifications could not be registered.');
    assert.deepEqual(f.calls.slice(-2), [['auto', false], ['revoke']]);
});

test('web partially failed registration unsubscribes its dedicated worker without creating a default Firebase worker', async t => {
    const f = webFixture(t);
    f.firebase.getToken = async () => {throw new Error('sensitive token response');};
    await assert.rejects(f.push.register(), error => error.message === 'Availability notifications could not be registered.');
    assert.deepEqual(f.calls.slice(-4).map(value => value[0]), ['find', 'unsubscribe', 'close', 'unregister']);
    assert.equal(f.calls.some(value => value[0] === 'delete'), false);
});

test('web malformed worker base paths fail before prompting or touching a service worker', async t => {
    const f = webFixture(t, {permission: 'default', base: '//outside.example'});
    assert.equal(await f.push.supported(), false);
    await assert.rejects(f.push.register(), /could not be requested/);
    assert.deepEqual(f.calls, []);
});

test('web failed transport revocation blocks registration until the subscription can be revoked', async t => {
    const f = webFixture(t);
    f.setExisting(f.registration);
    f.registration.pushManager.getSubscription = async () => ({unsubscribe: async () => false});
    await assert.rejects(f.push.unregister(), /could not be disabled/);
    await assert.rejects(f.push.register(), /could not be registered/);
    assert.equal(f.calls.some(value => value[0] === 'token'), false);
    f.registration.pushManager.getSubscription = async () => null;
    await f.push.register();
    assert.equal(f.calls.filter(value => value[0] === 'token').length, 1);
});

test('native registration fails and revokes delivery if restoring automatic token refresh fails', async () => {
    const f = nativeFixture();
    f.notifications.setAutoServerRegistrationEnabledAsync = async enabled => {
        f.calls.push(['auto', enabled]);
        if (enabled) throw new Error('registration state unavailable');
    };
    await assert.rejects(f.push.register(), /could not be registered/);
    assert.deepEqual(f.calls.slice(-3), [['auto', true], ['auto', false], ['revoke']]);
});

test('web token validation matches the bounded enrollment contract', async t => {
    const f = webFixture(t);
    for (const token of ['x'.repeat(19), 'x'.repeat(2049), 'fcm.token_abcdefghijklmnop']) {
        f.firebase.getToken = async () => token;
        await assert.rejects(f.push.register(), /could not be registered/);
    }
    for (const token of ['x'.repeat(20), 'x'.repeat(2048), 'fcm:token-abcdefgh_ijklmnop']) {
        f.firebase.getToken = async () => token;
        assert.deepEqual(await f.push.register(), {kind: 'fcm', token});
    }
});
