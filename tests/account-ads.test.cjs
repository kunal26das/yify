const assert = require('node:assert/strict');
const {test, before, after} = require('node:test');
const {loadTypeScript} = require('./helpers/load-typescript.cjs');

const originalDev = global.__DEV__;
before(() => { global.__DEV__ = false; });
after(() => {
    if (originalDev === undefined) delete global.__DEV__;
    else global.__DEV__ = originalDev;
});

function authFixture({recentLogin = true, result, reauthenticate} = {}) {
    const originalUser = {uid: 'account-a', displayName: 'A', email: 'a@example.test', photoURL: null};
    const otherUser = {uid: 'account-b'};
    const auth = {currentUser: originalUser};
    const calls = {deleted: [], reauthenticated: [], signedIn: [], revoked: 0};
    const {FirebaseAuthRepositoryImpl} = loadTypeScript('data/repositories/FirebaseAuthRepositoryImpl.ts', {
        '@react-native-firebase/auth': {
            getAuth: () => auth,
            GoogleAuthProvider: {credential: (token) => ({token})},
            onAuthStateChanged: (_, listener) => listener(auth.currentUser),
            deleteUser: async (user) => {
                calls.deleted.push(user);
                if (recentLogin && calls.deleted.length === 1) {
                    throw {code: 'auth/requires-recent-login'};
                }
            },
            reauthenticateWithCredential: async (user, credential) => {
                calls.reauthenticated.push({user, credential});
                return reauthenticate ? reauthenticate({user, auth, otherUser}) : {user};
            },
            signInWithCredential: async (_, credential) => {
                calls.signedIn.push(credential);
                auth.currentUser = otherUser;
                return {user: otherUser};
            },
        },
        '@react-native-google-signin/google-signin': {
            statusCodes: {SIGN_IN_CANCELLED: 'cancelled', IN_PROGRESS: 'in_progress'},
            GoogleSignin: {
                configure: () => {},
                hasPlayServices: async () => {},
                signIn: async () => result ?? {type: 'success', data: {idToken: 'selected-google-token'}},
                revokeAccess: async () => { calls.revoked += 1; },
                signOut: async () => {},
            },
        },
    });
    const repository = new FirebaseAuthRepositoryImpl();
    repository.init();
    return {repository, calls, auth, originalUser};
}

test('account deletion retries only the original user after reauthentication', async () => {
    const {repository, calls, originalUser} = authFixture();
    assert.equal(await repository.deleteAccount(), true);
    assert.deepEqual(calls.deleted, [originalUser, originalUser]);
    assert.deepEqual(calls.reauthenticated, [{
        user: originalUser,
        credential: {token: 'selected-google-token'},
    }]);
    assert.equal(calls.signedIn.length, 0);
    assert.equal(repository.getSession().account, null);
});

test('a different Google identity cannot replace the account being deleted', async () => {
    const {repository, calls, auth, originalUser} = authFixture({
        reauthenticate: async () => { throw {code: 'auth/user-mismatch'}; },
    });
    assert.equal(await repository.deleteAccount(), false);
    assert.deepEqual(calls.deleted, [originalUser]);
    assert.equal(calls.signedIn.length, 0);
    assert.equal(calls.revoked, 0);
    assert.equal(auth.currentUser, originalUser);
    assert.equal(repository.getSession().account.uid, originalUser.uid);
});

test('a mismatched reauthentication response is rejected before another delete', async () => {
    const {repository, calls, originalUser} = authFixture({
        reauthenticate: async ({otherUser}) => ({user: otherUser}),
    });
    assert.equal(await repository.deleteAccount(), false);
    assert.deepEqual(calls.deleted, [originalUser]);
    assert.equal(calls.revoked, 0);
});

test('account changes while reauthenticating stop the deletion retry', async () => {
    const {repository, calls, originalUser} = authFixture({
        reauthenticate: async ({user, auth, otherUser}) => {
            auth.currentUser = otherUser;
            return {user};
        },
    });
    assert.equal(await repository.deleteAccount(), false);
    assert.deepEqual(calls.deleted, [originalUser]);
    assert.equal(calls.revoked, 0);
});

test('cancelled Google reauthentication leaves the original account intact', async () => {
    const {repository, calls, originalUser} = authFixture({result: {type: 'cancelled'}});
    assert.equal(await repository.deleteAccount(), false);
    assert.deepEqual(calls.deleted, [originalUser]);
    assert.equal(calls.reauthenticated.length, 0);
    assert.equal(calls.revoked, 0);
});

test('a recent login deletes directly without another Google prompt', async () => {
    const {repository, calls, originalUser} = authFixture({recentLogin: false});
    assert.equal(await repository.deleteAccount(), true);
    assert.deepEqual(calls.deleted, [originalUser]);
    assert.equal(calls.reauthenticated.length, 0);
});

const consentInfo = (canRequestAds, privacyRequired = false) => ({
    canRequestAds,
    privacyOptionsRequirementStatus: privacyRequired ? 'REQUIRED' : 'NOT_REQUIRED',
});

function adsFixture({gatherConsent, getConsentInfo = async () => consentInfo(false)}) {
    const calls = {initialized: 0, requests: 0, loaded: 0, fallback: 0, events: []};
    const {AdMobAdGateway} = loadTypeScript('data/services/AdMobAdGateway.ts', {
        'react-native': {Platform: {OS: 'android'}},
        'react-native-google-mobile-ads': {
            __esModule: true,
            default: () => ({
                setRequestConfiguration: async () => {},
                initialize: async () => { calls.initialized += 1; },
            }),
            AdsConsent: {
                gatherConsent,
                getConsentInfo: async () => {
                    calls.fallback += 1;
                    return getConsentInfo();
                },
            },
            AdsConsentPrivacyOptionsRequirementStatus: {REQUIRED: 'REQUIRED'},
            MaxAdContentRating: {T: 'T'},
            RevenuePrecisions: {UNKNOWN: 0, ESTIMATED: 1, PUBLISHER_PROVIDED: 2, PRECISE: 3},
            AdEventType: {PAID: 'paid', LOADED: 'loaded', ERROR: 'error'},
            InterstitialAd: {
                createForAdRequest: () => {
                    calls.requests += 1;
                    return {
                        addAdEventListener: () => () => {},
                        load: () => { calls.loaded += 1; },
                    };
                },
            },
        },
        '../datasources/platform/ForegroundWatcher': {},
    });
    const gateway = new AdMobAdGateway({
        analytics: {trackEvent: (name, data) => calls.events.push({name, data})},
        adRevenue: {
            trackLoaded: () => {},
            trackDisplayed: () => {},
            trackOpened: () => {},
            trackFailedToLoad: () => {},
            trackImpression: () => {},
        },
        entitlement: () => ({ready: true, adsRemoved: false}),
    });
    return {gateway, calls};
}

test('consent rejection prevents ad initialization and loading', async () => {
    const {gateway, calls} = adsFixture({gatherConsent: async () => consentInfo(false, true)});
    await gateway.init();
    assert.equal(calls.initialized, 0);
    assert.equal(calls.requests, 0);
    assert.equal(calls.fallback, 0);
    assert.equal(gateway.privacyOptionsRequired(), true);
});

test('failed consent gathering uses SDK consent from the previous session', async () => {
    const {gateway, calls} = adsFixture({
        gatherConsent: async () => { throw new Error('offline'); },
        getConsentInfo: async () => consentInfo(true, true),
    });
    await gateway.init();
    assert.equal(calls.fallback, 1);
    assert.equal(calls.initialized, 1);
    assert.equal(calls.loaded, 1);
    assert.equal(gateway.privacyOptionsRequired(), true);
});

test('failed consent gathering cannot permit ads without SDK consent', async () => {
    const {gateway, calls} = adsFixture({
        gatherConsent: async () => { throw new Error('offline'); },
        getConsentInfo: async () => consentInfo(false, true),
    });
    await gateway.init();
    assert.equal(calls.fallback, 1);
    assert.equal(calls.initialized, 0);
    assert.equal(calls.requests, 0);
    assert.equal(gateway.privacyOptionsRequired(), true);
});

test('failure of both consent requests fails closed and permits a later retry', async () => {
    let offline = true;
    const {gateway, calls} = adsFixture({
        gatherConsent: async () => {
            if (offline) throw new Error('offline');
            return consentInfo(true);
        },
        getConsentInfo: async () => { throw new Error('consent info unavailable'); },
    });
    await gateway.init();
    assert.equal(calls.initialized, 0);
    assert.equal(calls.requests, 0);
    offline = false;
    await gateway.init();
    assert.equal(calls.initialized, 1);
    assert.equal(calls.loaded, 1);
});

test('initialization waits for consent and shares concurrent requests', async () => {
    let resolveConsent;
    const {gateway, calls} = adsFixture({
        gatherConsent: () => new Promise((resolve) => { resolveConsent = resolve; }),
    });
    const first = gateway.init();
    const second = gateway.init();
    assert.equal(first, second);
    assert.equal(calls.initialized, 0);
    assert.equal(calls.requests, 0);
    resolveConsent(consentInfo(true));
    await first;
    assert.equal(calls.initialized, 1);
    assert.equal(calls.loaded, 1);
});
