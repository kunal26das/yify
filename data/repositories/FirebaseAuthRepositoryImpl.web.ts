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

import {INITIAL_AUTH_SESSION, type Account, type AuthRepository, type AuthSession} from '@/domain';
import {getFirebaseApp} from '../datasources/firebase/FirebaseWebApp';
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

export class FirebaseAuthRepositoryImpl implements AuthRepository {
    private readonly store = createObservable<AuthSession>(INITIAL_AUTH_SESSION);
    private instance: Auth | null = null;
    private started = false;

    init(): void {
        if (this.started || typeof window === 'undefined') return;
        this.started = true;
        const auth = this.getAuthInstance();
        if (auth == null) {
            this.store.set({ready: true, available: false});
            return;
        }
        this.store.set({available: true});
        void setPersistence(auth, browserLocalPersistence).catch(() => undefined);
        onAuthStateChanged(auth, (user) => {
            this.store.set({ready: true, account: toAccount(user), signingIn: false});
        });
        void getRedirectResult(auth).catch((error: unknown) => {
            const code = errorCode(error);
            if (!SILENT.has(code)) this.store.set({error: code || 'sign-in failed'});
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
        if (auth == null) return false;
        this.store.set({signingIn: true, error: null});
        const provider = new GoogleAuthProvider();
        provider.setCustomParameters({prompt: 'select_account'});
        try {
            const credential = await signInWithPopup(auth, provider);
            this.store.set({account: toAccount(credential.user), signingIn: false});
            return true;
        } catch (error) {
            const code = errorCode(error);
            if (POPUP_BLOCKED.has(code)) {
                try {
                    await signInWithRedirect(auth, provider);
                    return true;
                } catch (redirectError) {
                    this.store.set({
                        signingIn: false,
                        error: errorCode(redirectError) || 'sign-in failed',
                    });
                    return false;
                }
            }
            this.store.set({
                signingIn: false,
                error: SILENT.has(code) ? null : code || 'sign-in failed',
            });
            return false;
        }
    }

    async signOut(): Promise<void> {
        const auth = this.getAuthInstance();
        if (auth == null) return;
        try {
            await signOut(auth);
        } catch {
        }
        this.store.set({account: null});
    }

    async deleteAccount(): Promise<boolean> {
        const auth = this.getAuthInstance();
        const user = auth?.currentUser;
        if (user == null) return false;
        try {
            await deleteUser(user);
        } catch (error) {
            if (errorCode(error) !== 'auth/requires-recent-login') return false;
            const provider = new GoogleAuthProvider();
            provider.setCustomParameters({prompt: 'select_account'});
            try {
                const reauthenticated = await reauthenticateWithPopup(user, provider);
                await deleteUser(reauthenticated.user);
            } catch {
                return false;
            }
        }
        this.store.set({account: null});
        return true;
    }

    async getIdToken(): Promise<string | null> {
        try {
            const auth = this.getAuthInstance();
            const user = auth?.currentUser;
            if (user == null) return null;
            return await firebaseGetIdToken(user);
        } catch {
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
