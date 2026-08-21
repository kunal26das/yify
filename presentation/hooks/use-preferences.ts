import {useSyncExternalStore} from 'react';
import {DEFAULT_PREFERENCES, type Preferences} from '@/domain';
import {usePreferencesRepository} from '../di/DependenciesContext';

const SERVER_SNAPSHOT: Preferences = {...DEFAULT_PREFERENCES, theme: 'system'};

export function usePreferences(): Preferences {
    const preferences = usePreferencesRepository();
    return useSyncExternalStore(
        (listener) => preferences.subscribe(listener),
        () => preferences.getPreferences(),
        () => SERVER_SNAPSHOT
    );
}
