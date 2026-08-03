import {useSyncExternalStore} from 'react';
import {IDLE_SYNC_STATUS, type SyncStatus} from '@/domain';
import {useAccountSync} from '../di/DependenciesContext';

export function useSyncStatus(): SyncStatus {
    const accountSync = useAccountSync();
    return useSyncExternalStore(
        (listener) => accountSync.subscribe(listener),
        () => accountSync.getStatus(),
        () => IDLE_SYNC_STATUS
    );
}
