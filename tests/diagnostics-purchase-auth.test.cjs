const assert = require('node:assert/strict');
const {test} = require('node:test');
const {loadTypeScript} = require('./helpers/load-typescript.cjs');

const account = {uid: 'private-account', displayName: 'Private name', email: 'private@example.test', photoURL: null};
const failure = code => Object.assign(new Error('private SDK response'), {code});
const tick = () => new Promise(resolve => setImmediate(resolve));

function recorder() {
    const operations = [];
    return {operations, diagnostics: {
        start(operation, attributes) {
            const entry = {operation, attributes};
            operations.push(entry);
            return {
                finish(outcome = 'ok', attributes) { Object.assign(entry, {outcome, finishAttributes: attributes}); },
                fail(error, attributes) { Object.assign(entry, {outcome: 'error', error, finishAttributes: attributes}); },
            };
        },
        event(operation, attributes) { operations.push({operation, attributes}); },
        capture(error, operation, attributes) { operations.push({operation, error, attributes}); },
    }};
}

function fixture(platform, t, options = {}) {
    const {operations, diagnostics} = recorder();
    const auth = {currentUser: account};
    const calls = [];
    let authListener;
    let deletions = 0;
    const common = {
        getAuth: () => auth,
        onAuthStateChanged: (_auth, listener) => { authListener = listener; listener(auth.currentUser); },
        deleteUser: async () => { calls.push('delete'); return options.delete?.(++deletions); },
        getIdToken: async user => {
            calls.push('token');
            if (options.tokenError) throw options.tokenError;
            return options.token ? options.token(user) : 'private-token';
        },
        signOut: async () => { calls.push('firebase_sign_out'); if (options.signOutError) throw options.signOutError; },
    };
    let Repository;
    if (platform === 'native') {
        const module = loadTypeScript('data/repositories/FirebaseAuthRepositoryImpl.ts', {
            '@react-native-firebase/auth': {
                ...common,
                GoogleAuthProvider: {credential: token => ({token})},
                signInWithCredential: async () => {
                    if (options.credentialError) throw options.credentialError;
                    return {user: account};
                },
                reauthenticateWithCredential: async () => ({user: account}),
            },
            '@react-native-google-signin/google-signin': {
                statusCodes: {SIGN_IN_CANCELLED: 'cancelled', IN_PROGRESS: 'in_progress', PLAY_SERVICES_NOT_AVAILABLE: 'play_services'},
                GoogleSignin: {
                    configure() { if (options.configureError) throw options.configureError; },
                    hasPlayServices: async () => {
                        if (options.playServicesError) throw options.playServicesError;
                        return true;
                    },
                    signIn: async () => {
                        calls.push('google_sign_in');
                        if (options.signIn) return options.signIn();
                        if (options.signInError) throw options.signInError;
                        return options.cancelResult ? {type: 'cancelled'} : {type: 'success', data: {idToken: 'private-token'}};
                    },
                    signOut: async () => { calls.push('google_sign_out'); if (options.googleSignOutError) throw options.googleSignOutError; },
                    revokeAccess: async () => { calls.push('revoke_access'); if (options.revokeError) throw options.revokeError; },
                },
            },
        });
        Repository = module.FirebaseAuthRepositoryImpl;
    } else {
        const originalWindow = global.window;
        global.window = {};
        t.after(() => {
            if (originalWindow === undefined) delete global.window;
            else global.window = originalWindow;
        });
        const module = loadTypeScript('data/repositories/FirebaseAuthRepositoryImpl.web.ts', {
            'firebase/auth': {
                ...common,
                GoogleAuthProvider: class { setCustomParameters() {} },
                browserLocalPersistence: {},
                setPersistence: async () => { if (options.persistenceError) throw options.persistenceError; },
                getRedirectResult: async () => { if (options.redirectResultError) throw options.redirectResultError; return null; },
                signInWithPopup: async () => { if (options.signInError) throw options.signInError; return {user: account}; },
                signInWithRedirect: async () => { calls.push('redirect'); if (options.redirectError) throw options.redirectError; },
                reauthenticateWithPopup: async () => { if (options.signInError) throw options.signInError; return {user: account}; },
            },
            '../datasources/firebase/FirebaseWebApp': {getFirebaseApp: () => ({})},
        });
        Repository = module.FirebaseAuthRepositoryImpl;
    }
    const repository = new Repository(diagnostics);
    repository.init();
    return {repository, operations, options, calls, auth,
        notifyAuth(user) {auth.currentUser = user; authListener(user);}};
}

test('native sign-in shares concurrent taps until the Google flow completes', async t => {
    let complete;
    const f = fixture('native', t, {signIn: () => new Promise(resolve => { complete = resolve; })});
    const first = f.repository.signIn();
    const second = f.repository.signIn();
    assert.equal(first, second);
    await tick();
    assert.equal(f.calls.filter(call => call === 'google_sign_in').length, 1);
    assert.equal(f.repository.getSession().signingIn, true);
    complete({type: 'success', data: {idToken: 'private-token'}});
    assert.equal(await first, true);
    assert.equal(f.repository.getSession().signingIn, false);
    f.options.signIn = null;
    assert.equal(await f.repository.signIn(), true);
    assert.equal(f.calls.filter(call => call === 'google_sign_in').length, 2);
});

for (const [code, expected] of [['7', 'network_request_failed'], ['8', 'internal_error'],
    ['10', 'developer_error'], ['15', 'timeout'], ['17', 'api_unavailable'], ['12500', 'sign_in_failed'],
    ['NULL_PRESENTER', 'presenter_unavailable']]) {
    test(`native Google sign-in preserves the bounded ${expected} cause`, async t => {
        const f = fixture('native', t, {signInError: failure(code)});
        assert.equal(await f.repository.signIn(), false);
        assert.deepEqual(f.operations.at(-1).finishAttributes, {stage: 'google', error_code: expected});
        assert.equal(f.operations.at(-1).outcome, 'error');
    });
}

test('native Google configuration failures are recoverable and identify their stage', async t => {
    const f = fixture('native', t, {configureError: failure('10')});
    assert.equal(f.repository.getSession().ready, true);
    assert.equal(f.repository.getSession().available, true);
    assert.equal(await f.repository.signIn(), false);
    assert.deepEqual(f.operations.at(-1).finishAttributes, {stage: 'configure', error_code: 'developer_error'});
    f.options.configureError = null;
    assert.equal(await f.repository.signIn(), true);
    assert.equal(f.repository.getSession().available, true);
    f.notifyAuth(null);
    assert.equal(f.repository.getSession().account, null);
});

test('native auth identifies whether Google Play services or Firebase rejected sign-in', async t => {
    const f = fixture('native', t, {playServicesError: failure('play_services')});
    assert.equal(await f.repository.signIn(), false);
    assert.deepEqual(f.operations.at(-1).finishAttributes,
        {stage: 'play_services', error_code: 'play_services_unavailable'});
    f.options.playServicesError = null;
    f.options.credentialError = failure('auth/invalid-credential');
    assert.equal(await f.repository.signIn(), false);
    assert.deepEqual(f.operations.at(-1).finishAttributes,
        {stage: 'firebase', error_code: 'invalid_credential'});
});

for (const platform of ['native', 'web']) {
    test(`${platform} offline token refresh preserves the account and can recover without a false denial`, async t => {
        const options = {tokenError: failure('auth/network-request-failed')};
        const f = fixture(platform, t, options);
        await assert.rejects(f.repository.getIdToken(), error => error.name === 'AuthTokenError' && error.failure === 'network');
        assert.equal(f.repository.getSession().account.uid, account.uid);
        assert.equal(f.operations.some(entry => entry.error), false);
        assert.equal(f.operations.at(-1).operation, 'auth.token_refresh');
        assert.equal(f.operations.at(-1).attributes.outcome, 'unavailable');
        options.tokenError = null;
        assert.equal(await f.repository.getIdToken(), 'private-token');
    });

    test(`${platform} revoked tokens retain their diagnostic error and classify authentication denial`, async t => {
        const error = failure('auth/user-token-expired');
        const f = fixture(platform, t, {tokenError: error});
        await assert.rejects(f.repository.getIdToken(), caught => caught.name === 'AuthTokenError' && caught.failure === 'denied');
        assert.deepEqual(f.operations.filter(entry => entry.error).map(entry => [entry.operation, entry.error]),
            [['auth.token_refresh', error]]);
    });

    test(`${platform} concurrent token refreshes share one request and discard a signed-out account token`, async t => {
        let resolve;
        const pending = new Promise(done => { resolve = done; });
        const f = fixture(platform, t, {token: () => pending});
        const first = f.repository.getIdToken();
        assert.equal(f.repository.getIdToken(), first);
        await tick();
        assert.equal(f.calls.filter(call => call === 'token').length, 1);
        f.auth.currentUser = null;
        resolve('stale-private-token');
        assert.equal(await first, null);
        assert.equal(await f.repository.getIdToken(), null);
        assert.equal(f.operations.some(entry => entry.error), false);
    });

    test(`${platform} auth diagnostics classify cancellation without an issue and bound unexpected error metadata`, async t => {
        const options = {signInError: failure(platform === 'native' ? 'cancelled' : 'auth/popup-closed-by-user')};
        const f = fixture(platform, t, options);
        assert.equal(await f.repository.signIn(), false);
        assert.equal(f.operations.at(-1).outcome, 'cancelled');
        assert.equal(f.operations.some(entry => entry.error), false);
        const error = failure('private-customer-error-code');
        options.signInError = error;
        assert.equal(await f.repository.signIn(), false);
        const event = f.operations.at(-1);
        assert.equal(event.error, error);
        assert.equal(event.finishAttributes.error_code, 'unknown');
        const metadata = JSON.stringify(f.operations.map(({error, ...entry}) => entry));
        assert.doesNotMatch(metadata, /private|token|credential|email|uid|displayName/);
    });

    test(`${platform} auth diagnostics report a swallowed sign-out failure without changing local sign-out`, async t => {
        const error = failure('auth/network-request-failed');
        const f = fixture(platform, t, {signOutError: error});
        await f.repository.signOut();
        assert.equal(f.repository.getSession().account, null);
        assert.deepEqual(f.operations.filter(entry => entry.error).map(entry => [entry.operation, entry.error]),
            [['auth.sign_out', error]]);
        assert.equal(f.operations.at(-1).finishAttributes.error_code, 'network_request_failed');
    });

    test(`${platform} deletion owns a failed retry once while successful reauthentication stays successful`, async t => {
        const error = failure('auth/network-request-failed');
        const f = fixture(platform, t, {delete: async attempt => {
            throw attempt === 1 ? failure('auth/requires-recent-login') : error;
        }});
        assert.equal(await f.repository.deleteAccount(), false);
        assert.equal(f.calls.filter(call => call === 'delete').length, 2);
        assert.deepEqual(f.operations.filter(entry => entry.error).map(entry => [entry.operation, entry.error]),
            [['auth.delete', error]]);
        assert.equal(f.operations.find(entry => entry.operation === 'auth.reauthenticate').outcome, 'ok');
    });

    test(`${platform} cancelled reauthentication creates no issue and leaves the account intact`, async t => {
        const f = fixture(platform, t, {
            delete: async () => { throw failure('auth/requires-recent-login'); },
            signInError: failure(platform === 'native' ? 'cancelled' : 'auth/popup-closed-by-user'),
        });
        assert.equal(await f.repository.deleteAccount(), false);
        assert.equal(f.calls.filter(call => call === 'delete').length, 1);
        assert.equal(f.operations.some(entry => entry.error), false);
        assert.equal(f.operations.find(entry => entry.operation === 'auth.reauthenticate').outcome, 'cancelled');
        assert.equal(f.repository.getSession().account.uid, account.uid);
    });
}

test('web popup fallback records pending redirect rather than confirmed authentication', async t => {
    const f = fixture('web', t, {signInError: failure('auth/popup-blocked')});
    assert.equal(await f.repository.signIn(), true);
    assert.deepEqual(f.calls, ['redirect']);
    assert.equal(f.operations.find(entry => entry.operation === 'auth.sign_in').outcome, 'pending');
    assert.equal(f.operations.some(entry => entry.error), false);
    assert.equal(f.operations.find(entry => entry.operation === 'auth.sign_in_fallback').attributes.error_code, 'popup_blocked');
});

test('web redirect completion captures previously swallowed failure without SDK payload attributes', async t => {
    const error = failure('auth/network-request-failed');
    const f = fixture('web', t, {redirectResultError: error});
    await tick();
    assert.deepEqual(f.operations.filter(entry => entry.error).map(entry => [entry.operation, entry.error]),
        [['auth.sign_in', error]]);
    assert.deepEqual(f.operations.at(-1).attributes, {
        provider: 'google', stage: 'redirect_result', error_code: 'network_request_failed',
    });
});

test('native account deletion reports cleanup failure while preserving successful deletion', async t => {
    const error = failure('auth/network-request-failed');
    const f = fixture('native', t, {revokeError: error});
    assert.equal(await f.repository.deleteAccount(), true);
    assert.equal(f.repository.getSession().account, null);
    assert.deepEqual(f.calls, ['delete', 'revoke_access', 'google_sign_out']);
    assert.equal(f.operations.find(entry => entry.operation === 'auth.delete').outcome, 'ok');
    assert.deepEqual(f.operations.filter(entry => entry.error).map(entry => [entry.operation, entry.error]),
        [['auth.delete_cleanup', error]]);
});
