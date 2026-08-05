import {
    GoogleAuthProvider,
    getAuth,
    getIdToken as firebaseGetIdToken,
    onAuthStateChanged,
    signInWithCredential,
    signOut,
    type FirebaseAuthTypes,
} from '@react-native-firebase/auth';
import {GoogleSignin, statusCodes} from '@react-native-google-signin/google-signin';

import {INITIAL_AUTH_SESSION, type Account, type AuthRepository, type AuthSession} from '@/domain';
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

export class FirebaseAuthRepositoryImpl implements AuthRepository {
    private readonly store = createObservable<AuthSession>(INITIAL_AUTH_SESSION);
    private started = false;
    private configured = false;

    init(): void {
        if (this.started) return;
        this.started = true;
        const available = this.ensureConfigured();
        this.store.set({available});
        try {
            onAuthStateChanged(getAuth(), (user) => {
                this.store.set({ready: true, account: toAccount(user), signingIn: false});
            });
        } catch {
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
        if (!this.ensureConfigured()) {
            this.store.set({error: 'google sign-in is not configured'});
            return false;
        }
        this.store.set({signingIn: true, error: null});
        try {
            await GoogleSignin.hasPlayServices({showPlayServicesUpdateDialog: true});
            const result = await GoogleSignin.signIn();
            if (result.type !== 'success' || !result.data.idToken) {
                this.store.set({signingIn: false});
                return false;
            }
            const credential = GoogleAuthProvider.credential(result.data.idToken);
            const signed = await signInWithCredential(getAuth(), credential);
            this.store.set({account: toAccount(signed.user), signingIn: false});
            return true;
        } catch (error) {
            const code = errorCode(error);
            this.store.set({
                signingIn: false,
                error: SILENT.has(code) ? null : code || 'sign-in failed',
            });
            return false;
        }
    }

    async signOut(): Promise<void> {
        try {
            if (this.configured) await GoogleSignin.signOut();
        } catch {
        }
        try {
            await signOut(getAuth());
        } catch {
        }
        this.store.set({account: null});
    }

    async getIdToken(): Promise<string | null> {
        try {
            const user = getAuth().currentUser;
            if (user == null) return null;
            return await firebaseGetIdToken(user);
        } catch {
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
