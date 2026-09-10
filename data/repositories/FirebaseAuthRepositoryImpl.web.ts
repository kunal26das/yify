import {
    GoogleAuthProvider,
    browserLocalPersistence,
    deleteUser,
    getAuth,
    getIdToken as firebaseGetIdToken,
    getRedirectResult,
    onAuthStateChanged,
    reauthenticateWithPopup,
    setPersistence,
    signInWithPopup,
    signInWithRedirect,
    signOut,
    type Auth,
    type User,
} from 'firebase/auth';

import {INITIAL_AUTH_SESSION, type Account, type AuthRepository, type AuthSession, type Diagnostics} from '@/domain';
import {getFirebaseApp} from '../datasources/firebase/FirebaseWebApp';
import {NOOP_DIAGNOSTICS} from '../services/NoopDiagnostics';
import {createObservable} from './support/observable';

const POPUP_BLOCKED = new Set([
    'auth/popup-blocked',
    'auth/operation-not-supported-in-this-environment',
    'auth/cancelled-popup-request',
]);

const SILENT = new Set(['auth/popup-closed-by-user', 'auth/cancelled-popup-request']);

function toAccount(user: User | null): Account | null {
    if (user == null) return null;
    return {
        uid: user.uid,
        name: user.displayName,
        email: user.email,
        photoUrl: user.photoURL,
    };
}

function errorCode(error: unknown): string {
    return typeof error === 'object' && error != null && 'code' in error
        ? String((error as {code: unknown}).code)
        : '';
}

const DIAGNOSTIC_AUTH_CODES = new Set([
    'auth/network-request-failed', 'auth/too-many-requests', 'auth/user-disabled',
    'auth/invalid-credential', 'auth/account-exists-with-different-credential',
    'auth/credential-already-in-use', 'auth/operation-not-allowed', 'auth/invalid-api-key',
    'auth/app-not-authorized', 'auth/unauthorized-domain', 'auth/internal-error',
    'auth/requires-recent-login', 'auth/user-token-expired', 'auth/invalid-user-token',
    'auth/popup-blocked', 'auth/popup-closed-by-user', 'auth/cancelled-popup-request',
    'auth/operation-not-supported-in-this-environment', 'auth/web-storage-unsupported',
]);

function diagnosticCode(error: unknown): string {
    try {
        const code = errorCode(error);
        return DIAGNOSTIC_AUTH_CODES.has(code) ? code.slice(5).replace(/-/g, '_') : 'unknown';
    } catch {
        return 'unknown';
    }
}

export class FirebaseAuthRepositoryImpl implements AuthRepository {
    private readonly store = createObservable<AuthSession>(INITIAL_AUTH_SESSION);
    private instance: Auth | null = null;
    private started = false;

    constructor(private readonly diagnostics: Diagnostics = NOOP_DIAGNOSTICS) {}

    init(): void {
        if (this.started || typeof window === 'undefined') return;
        this.started = true;
        const auth = this.getAuthInstance();
        if (auth == null) {
            this.store.set({ready: true, available: false});
            return;
        }
        this.store.set({available: true});
        void setPersistence(auth, browserLocalPersistence).catch((error: unknown) => {
            this.diagnostics.capture(error, 'auth.persistence', {provider: 'google', error_code: diagnosticCode(error)});
        });
        onAuthStateChanged(auth, (user) => {
            this.store.set({ready: true, account: toAccount(user), signingIn: false});
        });
        void getRedirectResult(auth).catch((error: unknown) => {
            const code = errorCode(error);
            if (!SILENT.has(code)) {
                this.diagnostics.capture(error, 'auth.sign_in', {provider: 'google', stage: 'redirect_result', error_code: diagnosticCode(error)});
                this.store.set({error: code || 'sign-in failed'});
            } else this.diagnostics.event('auth.sign_in', {outcome: 'cancelled', stage: 'redirect_result'});
        });
    }

    getSession(): AuthSession {
        return this.store.get();
    }

    subscribe(listener: () => void): () => void {
        return this.store.subscribe(listener);
    }

    async signIn(): Promise<boolean> {
        const auth = this.getAuthInstance();
        const span = this.diagnostics.start('auth.sign_in', {provider: 'google'});
        if (auth == null) { span.finish('unavailable'); return false; }
        this.store.set({signingIn: true, error: null});
        const provider = new GoogleAuthProvider();
        provider.setCustomParameters({prompt: 'select_account'});
        try {
            const credential = await signInWithPopup(auth, provider);
            this.store.set({account: toAccount(credential.user), signingIn: false});
            span.finish('ok', {stage: 'popup'});
            return true;
        } catch (error) {
            const code = errorCode(error);
            if (POPUP_BLOCKED.has(code)) {
                this.diagnostics.event('auth.sign_in_fallback', {provider: 'google', stage: 'redirect', error_code: diagnosticCode(error)});
                try {
                    await signInWithRedirect(auth, provider);
                    span.finish('pending', {stage: 'redirect'});
                    return true;
                } catch (redirectError) {
                    if (SILENT.has(errorCode(redirectError))) span.finish('cancelled', {stage: 'redirect'});
                    else span.fail(redirectError, {stage: 'redirect', error_code: diagnosticCode(redirectError)});
                    this.store.set({
                        signingIn: false,
                        error: errorCode(redirectError) || 'sign-in failed',
                    });
                    return false;
                }
            }
            if (SILENT.has(code)) span.finish('cancelled', {stage: 'popup'});
            else span.fail(error, {stage: 'popup', error_code: diagnosticCode(error)});
            this.store.set({
                signingIn: false,
                error: SILENT.has(code) ? null : code || 'sign-in failed',
            });
            return false;
        }
    }

    async signOut(): Promise<void> {
        const auth = this.getAuthInstance();
        const span = this.diagnostics.start('auth.sign_out', {provider: 'google'});
        if (auth == null) { span.finish('unavailable'); return; }
        try {
            await signOut(auth);
            span.finish('ok');
        } catch (error) {
            span.fail(error, {error_code: diagnosticCode(error)});
        }
        this.store.set({account: null});
    }

    async deleteAccount(): Promise<boolean> {
        const auth = this.getAuthInstance();
        const user = auth?.currentUser;
        const span = this.diagnostics.start('auth.delete', {provider: 'google'});
        if (user == null) { span.finish('unavailable'); return false; }
        try {
            await deleteUser(user);
        } catch (error) {
            if (errorCode(error) !== 'auth/requires-recent-login') {
                span.fail(error, {stage: 'delete', error_code: diagnosticCode(error)});
                return false;
            }
            const provider = new GoogleAuthProvider();
            provider.setCustomParameters({prompt: 'select_account'});
            const reauthentication = this.diagnostics.start('auth.reauthenticate', {provider: 'google'});
            let stage = 'reauthenticate';
            try {
                const reauthenticated = await reauthenticateWithPopup(user, provider);
                reauthentication.finish('ok');
                stage = 'delete_after_reauthentication';
                await deleteUser(reauthenticated.user);
            } catch (retryError) {
                if (stage === 'reauthenticate') {
                    if (SILENT.has(errorCode(retryError))) reauthentication.finish('cancelled');
                    else reauthentication.fail(retryError, {error_code: diagnosticCode(retryError)});
                    span.finish('skipped', {stage});
                } else span.fail(retryError, {stage, error_code: diagnosticCode(retryError)});
                return false;
            }
        }
        this.store.set({account: null});
        span.finish('ok');
        return true;
    }

    async getIdToken(): Promise<string | null> {
        try {
            const auth = this.getAuthInstance();
            const user = auth?.currentUser;
            if (user == null) return null;
            return await firebaseGetIdToken(user);
        } catch (error) {
            this.diagnostics.capture(error, 'auth.token_refresh', {provider: 'google', error_code: diagnosticCode(error)});
            return null;
        }
    }

    private getAuthInstance(): Auth | null {
        if (this.instance != null) return this.instance;
        const app = getFirebaseApp();
        if (app == null) return null;
        this.instance = getAuth(app);
        return this.instance;
    }
}
