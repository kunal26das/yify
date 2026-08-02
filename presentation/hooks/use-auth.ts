import {useSyncExternalStore} from 'react';
import {getAuthState, subscribeAuth} from '@/lib/auth';
import {INITIAL_AUTH_STATE, type AuthState} from '@/lib/auth-state';

export function useAuth(): AuthState {
    return useSyncExternalStore(subscribeAuth, getAuthState, () => INITIAL_AUTH_STATE);
}
