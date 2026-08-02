import {Analytics} from './analytics-events';
import {getAuthState, subscribeAuth} from './auth';
import {identifyPurchasesUser} from './purchases';
import {setSyncAccount} from './sync/account-sync';

let started = false;
let lastUid: string | null | undefined;

export function startAccountLink(): void {
    if (started) return;
    started = true;

    const apply = () => {
        const {ready, user} = getAuthState();
        if (!ready) return;
        const uid = user?.uid ?? null;
        if (uid === lastUid) return;
        lastUid = uid;
        if (uid) Analytics.signIn('google');
        void identifyPurchasesUser(user);
        setSyncAccount(uid);
    };

    subscribeAuth(apply);
    apply();
}
