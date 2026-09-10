import {
    GoogleAuthProvider,
    deleteUser,
    getAuth,
    getIdToken as firebaseGetIdToken,
    onAuthStateChanged,
    reauthenticateWithCredential,
    signInWithCredential,
    signOut,
    type FirebaseAuthTypes,
} from '@react-native-firebase/auth';
import {GoogleSignin, statusCodes} from '@react-native-google-signin/google-signin';

import {INITIAL_AUTH_SESSION, type Account, type AuthRepository, type AuthSession, type Diagnostics} from '@/domain';
import {NOOP_DIAGNOSTICS} from '../services/NoopDiagnostics';
import {createObservable} from './support/observable';

const FALLBACK_WEB_CLIENT_ID =
    '325235052319-09fsjb9phn2s764ja02qgmbdcg88b0in.apps.googleusercontent.com';

const WEB_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID || FALLBACK_WEB_CLIENT_ID;

const SILENT = new Set<string>([statusCodes.SIGN_IN_CANCELLED, statusCodes.IN_PROGRESS]);

function toAccount(user: FirebaseAuthTypes.User | null): Account | null {
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
        if (code === statusCodes.SIGN_IN_CANCELLED) return 'cancelled';
        if (code === statusCodes.IN_PROGRESS) return 'in_progress';
        if (code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE) return 'play_services_unavailable';
        return DIAGNOSTIC_AUTH_CODES.has(code) ? code.slice(5).replace(/-/g, '_') : 'unknown';
    } catch {
        return 'unknown';
    }
}

export class FirebaseAuthRepositoryImpl implements AuthRepository {
    private readonly store = createObservable<AuthSession>(INITIAL_AUTH_SESSION);
    private started = false;
    private configured = false;

    constructor(private readonly diagnostics: Diagnostics = NOOP_DIAGNOSTICS) {}

    init(): void {
        if (this.started) return;
        this.started = true;
        const available = this.ensureConfigured();
        this.store.set({available});
        try {
            onAuthStateChanged(getAuth(), (user) => {
                this.store.set({ready: true, account: toAccount(user), signingIn: false});
            });
        } catch (error) {
            this.diagnostics.capture(error, 'auth.initialize', {provider: 'google', error_code: diagnosticCode(error)});
            this.store.set({ready: true, available: false});
        }
    }

    getSession(): AuthSession {
        return this.store.get();
    }

    subscribe(listener: () => void): () => void {
        return this.store.subscribe(listener);
    }

    async signIn(): Promise<boolean> {
        const span = this.diagnostics.start('auth.sign_in', {provider: 'google'});
        if (!this.ensureConfigured()) {
            this.store.set({error: 'google sign-in is not configured'});
            span.finish('unavailable', {stage: 'configure'});
            return false;
        }
        this.store.set({signingIn: true, error: null});
        try {
            await GoogleSignin.hasPlayServices({showPlayServicesUpdateDialog: true});
            const result = await GoogleSignin.signIn();
            if (result.type !== 'success' || !result.data.idToken) {
                this.store.set({signingIn: false});
                span.finish(result.type !== 'success' ? 'cancelled' : 'unavailable');
                return false;
            }
            const credential = GoogleAuthProvider.credential(result.data.idToken);
            const signed = await signInWithCredential(getAuth(), credential);
            this.store.set({account: toAccount(signed.user), signingIn: false});
            span.finish('ok');
            return true;
        } catch (error) {
            const code = errorCode(error);
            if (SILENT.has(code)) span.finish(code === statusCodes.IN_PROGRESS ? 'skipped' : 'cancelled');
            else span.fail(error, {error_code: diagnosticCode(error)});
            this.store.set({
                signingIn: false,
                error: SILENT.has(code) ? null : code || 'sign-in failed',
            });
            return false;
        }
    }

    async signOut(): Promise<void> {
        const span = this.diagnostics.start('auth.sign_out', {provider: 'google'});
        let failure: {error: unknown; stage: string} | undefined;
        try {
            if (this.configured) await GoogleSignin.signOut();
        } catch (error) {
            failure = {error, stage: 'google'};
        }
        try {
            await signOut(getAuth());
        } catch (error) {
            failure ??= {error, stage: 'firebase'};
        }
        this.store.set({account: null});
        if (failure) span.fail(failure.error, {stage: failure.stage, error_code: diagnosticCode(failure.error)});
        else span.finish('ok');
    }

    async deleteAccount(): Promise<boolean> {
        const user = getAuth().currentUser;
        const span = this.diagnostics.start('auth.delete', {provider: 'google'});
        if (user == null) { span.finish('unavailable'); return false; }
        try {
            await deleteUser(user);
        } catch (error) {
            if (errorCode(error) !== 'auth/requires-recent-login') {
                span.fail(error, {stage: 'delete', error_code: diagnosticCode(error)});
                return false;
            }
            if (!await this.reauthenticate(user)) {
                span.finish('skipped', {stage: 'reauthenticate'});
                return false;
            }
            try {
                await deleteUser(user);
            } catch (deleteError) {
                span.fail(deleteError, {stage: 'delete_after_reauthentication', error_code: diagnosticCode(deleteError)});
                return false;
            }
        }
        let cleanupFailure: {error: unknown; stage: string} | undefined;
        try {
            if (this.configured) await GoogleSignin.revokeAccess();
        } catch (error) {
            cleanupFailure = {error, stage: 'revoke_access'};
        }
        try {
            if (this.configured) await GoogleSignin.signOut();
        } catch (error) {
            cleanupFailure ??= {error, stage: 'sign_out'};
        }
        if (cleanupFailure) this.diagnostics.capture(cleanupFailure.error, 'auth.delete_cleanup', {
            provider: 'google', stage: cleanupFailure.stage, error_code: diagnosticCode(cleanupFailure.error),
        });
        this.store.set({account: null});
        span.finish('ok');
        return true;
    }

    private async reauthenticate(user: FirebaseAuthTypes.User): Promise<boolean> {
        const span = this.diagnostics.start('auth.reauthenticate', {provider: 'google'});
        if (!this.ensureConfigured()) { span.finish('unavailable'); return false; }
        try {
            await GoogleSignin.hasPlayServices({showPlayServicesUpdateDialog: true});
            const result = await GoogleSignin.signIn();
            if (result.type !== 'success' || !result.data.idToken) {
                span.finish(result.type !== 'success' ? 'cancelled' : 'unavailable');
                return false;
            }
            const credential = GoogleAuthProvider.credential(result.data.idToken);
            const refreshed = await reauthenticateWithCredential(user, credential);
            const matches = refreshed.user.uid === user.uid && getAuth().currentUser?.uid === user.uid;
            span.finish(matches ? 'ok' : 'unavailable', {stage: 'identity'});
            return matches;
        } catch (error) {
            const code = errorCode(error);
            if (SILENT.has(code)) span.finish(code === statusCodes.IN_PROGRESS ? 'skipped' : 'cancelled');
            else span.fail(error, {error_code: diagnosticCode(error)});
            return false;
        }
    }

    async getIdToken(): Promise<string | null> {
        try {
            const user = getAuth().currentUser;
            if (user == null) return null;
            return await firebaseGetIdToken(user);
        } catch (error) {
            this.diagnostics.capture(error, 'auth.token_refresh', {provider: 'google', error_code: diagnosticCode(error)});
            return null;
        }
    }

    private ensureConfigured(): boolean {
        if (!WEB_CLIENT_ID) return false;
        if (this.configured) return true;
        GoogleSignin.configure({webClientId: WEB_CLIENT_ID, offlineAccess: false});
        this.configured = true;
        return true;
    }
}
