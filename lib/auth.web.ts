import {
    GoogleAuthProvider,
    browserLocalPersistence,
    getAuth,
    getRedirectResult,
    onAuthStateChanged,
    setPersistence,
    signInWithPopup,
    signInWithRedirect,
    signOut,
    type Auth,
    type User,
} from 'firebase/auth';

import {createAuthStore, type AuthState, type AuthUser} from './auth-state';
import {getFirebaseApp} from './firebase';

const POPUP_BLOCKED = new Set([
    'auth/popup-blocked',
    'auth/operation-not-supported-in-this-environment',
    'auth/cancelled-popup-request',
]);

const SILENT = new Set(['auth/popup-closed-by-user', 'auth/cancelled-popup-request']);

const store = createAuthStore();

let instance: Auth | null = null;
let started = false;

function getAuthInstance(): Auth | null {
    if (instance != null) return instance;
    const app = getFirebaseApp();
    if (app == null) return null;
    instance = getAuth(app);
    return instance;
}

function toUser(user: User | null): AuthUser | null {
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

export function initAuth(): void {
    if (started || typeof window === 'undefined') return;
    started = true;
    const auth = getAuthInstance();
    if (auth == null) {
        store.set({ready: true, available: false});
        return;
    }
    store.set({available: true});
    void setPersistence(auth, browserLocalPersistence).catch(() => undefined);
    onAuthStateChanged(auth, (user) => {
        store.set({ready: true, user: toUser(user), signingIn: false});
    });
    void getRedirectResult(auth).catch((error: unknown) => {
        const code = errorCode(error);
        if (!SILENT.has(code)) store.set({error: code || 'sign-in failed'});
    });
}

export function subscribeAuth(listener: () => void): () => void {
    return store.subscribe(listener);
}

export function getAuthState(): AuthState {
    return store.get();
}

export async function signInWithGoogle(): Promise<boolean> {
    const auth = getAuthInstance();
    if (auth == null) return false;
    store.set({signingIn: true, error: null});
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({prompt: 'select_account'});
    try {
        const credential = await signInWithPopup(auth, provider);
        store.set({user: toUser(credential.user), signingIn: false});
        return true;
    } catch (error) {
        const code = errorCode(error);
        if (POPUP_BLOCKED.has(code)) {
            try {
                await signInWithRedirect(auth, provider);
                return true;
            } catch (redirectError) {
                store.set({signingIn: false, error: errorCode(redirectError) || 'sign-in failed'});
                return false;
            }
        }
        store.set({signingIn: false, error: SILENT.has(code) ? null : code || 'sign-in failed'});
        return false;
    }
}

export async function signOutOfAccount(): Promise<void> {
    const auth = getAuthInstance();
    if (auth == null) return;
    try {
        await signOut(auth);
    } catch {
    }
    store.set({user: null});
}
