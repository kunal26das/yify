import {
    GoogleAuthProvider,
    getAuth,
    onAuthStateChanged,
    signInWithCredential,
    signOut,
    type FirebaseAuthTypes,
} from '@react-native-firebase/auth';
import {GoogleSignin, statusCodes} from '@react-native-google-signin/google-signin';

import {createAuthStore, type AuthState, type AuthUser} from './auth-state';

const WEB_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID ?? '';

const SILENT = new Set<string>([statusCodes.SIGN_IN_CANCELLED, statusCodes.IN_PROGRESS]);

const store = createAuthStore();

let started = false;
let configured = false;

function toUser(user: FirebaseAuthTypes.User | null): AuthUser | null {
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

function ensureConfigured(): boolean {
    if (!WEB_CLIENT_ID) return false;
    if (configured) return true;
    GoogleSignin.configure({webClientId: WEB_CLIENT_ID, offlineAccess: false});
    configured = true;
    return true;
}

export function initAuth(): void {
    if (started) return;
    started = true;
    const available = ensureConfigured();
    store.set({available});
    try {
        onAuthStateChanged(getAuth(), (user) => {
            store.set({ready: true, user: toUser(user), signingIn: false});
        });
    } catch {
        store.set({ready: true, available: false});
    }
}

export function subscribeAuth(listener: () => void): () => void {
    return store.subscribe(listener);
}

export function getAuthState(): AuthState {
    return store.get();
}

export async function signInWithGoogle(): Promise<boolean> {
    if (!ensureConfigured()) {
        store.set({error: 'google sign-in is not configured'});
        return false;
    }
    store.set({signingIn: true, error: null});
    try {
        await GoogleSignin.hasPlayServices({showPlayServicesUpdateDialog: true});
        const result = await GoogleSignin.signIn();
        if (result.type !== 'success' || !result.data.idToken) {
            store.set({signingIn: false});
            return false;
        }
        const credential = GoogleAuthProvider.credential(result.data.idToken);
        const signed = await signInWithCredential(getAuth(), credential);
        store.set({user: toUser(signed.user), signingIn: false});
        return true;
    } catch (error) {
        const code = errorCode(error);
        store.set({signingIn: false, error: SILENT.has(code) ? null : code || 'sign-in failed'});
        return false;
    }
}

export async function signOutOfAccount(): Promise<void> {
    try {
        if (configured) await GoogleSignin.signOut();
    } catch {
    }
    try {
        await signOut(getAuth());
    } catch {
    }
    store.set({user: null});
}
