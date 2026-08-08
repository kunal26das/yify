import {useSyncExternalStore} from 'react';
import {DEFAULT_BROWSE_DEFAULTS, type Preferences} from '@/domain';
import {usePreferencesRepository} from '../di/DependenciesContext';

const SERVER_SNAPSHOT: Preferences = {
    theme: 'system',
    notifications: true,
    confirmWatchlistRemoval: true,
    browseDefaults: DEFAULT_BROWSE_DEFAULTS,
};

export function usePreferences(): Preferences {
    const preferences = usePreferencesRepository();
    return useSyncExternalStore(
        (listener) => preferences.subscribe(listener),
        () => preferences.getPreferences(),
        () => SERVER_SNAPSHOT
    );
}
