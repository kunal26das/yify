import {useSyncExternalStore} from 'react';
import {BROWSE_DEFAULTS, getPreferences, subscribePreferences, type Preferences} from '@/lib/preferences';

const SERVER_SNAPSHOT: Preferences = {theme: 'system', notifications: true, browseDefaults: BROWSE_DEFAULTS};

export function usePreferences(): Preferences {
    return useSyncExternalStore(subscribePreferences, getPreferences, () => SERVER_SNAPSHOT);
}
