import {getAuth, getIdToken as firebaseGetIdToken} from '@react-native-firebase/auth';

export async function getIdToken(): Promise<string | null> {
    try {
        const user = getAuth().currentUser;
        if (user == null) return null;
        return await firebaseGetIdToken(user);
    } catch {
        return null;
    }
}
