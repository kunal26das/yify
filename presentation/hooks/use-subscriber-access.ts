import {useCallback, useEffect, useSyncExternalStore} from 'react';
import {AppState} from 'react-native';
import type {SubscriberAccessState} from '@/domain';
import {useSubscriberAccessService} from '../di/DependenciesContext';
import {useAuth} from './use-auth';

export function useSubscriberAccess(): {status: SubscriberAccessState; refresh: () => Promise<void>} {
    const service = useSubscriberAccessService();
    const session = useAuth();
    const status = useSyncExternalStore(
        useCallback(listener => service.subscribe(listener), [service]),
        useCallback(() => service.getState(), [service]),
        () => 'checking' as const,
    );
    const refresh = useCallback(() => service.refresh(), [service]);
    useEffect(() => {
        const subscription = AppState.addEventListener('change', state => {
            if (state === 'active') void refresh();
        });
        return () => subscription.remove();
    }, [refresh]);
    return {status: !session.ready ? 'checking' : session.account ? status : 'denied', refresh};
}
