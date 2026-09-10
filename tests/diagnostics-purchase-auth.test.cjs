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
    let deletions = 0;
    const common = {
        getAuth: () => auth,
        onAuthStateChanged: (_auth, listener) => listener(auth.currentUser),
        deleteUser: async () => { calls.push('delete'); return options.delete?.(++deletions); },
        getIdToken: async () => { if (options.tokenError) throw options.tokenError; return 'private-token'; },
        signOut: async () => { calls.push('firebase_sign_out'); if (options.signOutError) throw options.signOutError; },
    };
    let Repository;
    if (platform === 'native') {
        const module = loadTypeScript('data/repositories/FirebaseAuthRepositoryImpl.ts', {
            '@react-native-firebase/auth': {
                ...common,
                GoogleAuthProvider: {credential: token => ({token})},
                signInWithCredential: async () => ({user: account}),
                reauthenticateWithCredential: async () => ({user: account}),
            },
            '@react-native-google-signin/google-signin': {
                statusCodes: {SIGN_IN_CANCELLED: 'cancelled', IN_PROGRESS: 'in_progress', PLAY_SERVICES_NOT_AVAILABLE: 'play_services'},
                GoogleSignin: {
                    configure() {},
                    hasPlayServices: async () => true,
                    signIn: async () => {
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
    return {repository, operations, options, calls};
}

for (const platform of ['native', 'web']) {
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
