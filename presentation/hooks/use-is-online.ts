import {useSyncExternalStore} from 'react';
import {useNetworkMonitor} from '../di/DependenciesContext';

export function useIsOnline(): boolean {
    const network = useNetworkMonitor();
    return useSyncExternalStore(
        (listener) => network.subscribe(listener),
        () => network.isOnline(),
        () => true
    );
}
