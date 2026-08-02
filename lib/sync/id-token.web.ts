import {getAuth, getIdToken as firebaseGetIdToken} from 'firebase/auth';

import {getFirebaseApp} from '../firebase';

export async function getIdToken(): Promise<string | null> {
    try {
        const app = getFirebaseApp();
        if (app == null) return null;
        const user = getAuth(app).currentUser;
        if (user == null) return null;
        return await firebaseGetIdToken(user);
    } catch {
        return null;
    }
}
