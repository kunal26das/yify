import {useEffect, useRef} from 'react';
import {useIsFocused} from 'expo-router';
import {useAuth} from './use-auth';
import {usePurchases} from './use-purchases';

export function useReloadOnCatalogAccess(reload: () => void, busy: boolean): void {
    const session = useAuth();
    const purchases = usePurchases();
    const focused = useIsFocused();
    const access = session.ready && session.account && purchases.ready && purchases.adsRemoved
        ? JSON.stringify([session.account.uid, purchases.expiresAt]) : null;
    const previous = useRef(access);
    const pending = useRef<string | null>(null);

    useEffect(() => {
        if (access !== previous.current) {
            previous.current = access;
            pending.current = access;
        }
        if (pending.current === null || busy || !focused) return;
        pending.current = null;
        reload();
    }, [access, busy, focused, reload]);
}
