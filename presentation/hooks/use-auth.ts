import {useSyncExternalStore} from 'react';
import {INITIAL_AUTH_SESSION, type AuthSession} from '@/domain';
import {useAuthRepository} from '../di/DependenciesContext';

export function useAuth(): AuthSession {
    const auth = useAuthRepository();
    return useSyncExternalStore(
        (listener) => auth.subscribe(listener),
        () => auth.getSession(),
        () => INITIAL_AUTH_SESSION
    );
}
