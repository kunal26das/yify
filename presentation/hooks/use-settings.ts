import {useSyncExternalStore} from 'react';
import {BROWSE_DEFAULTS, getSettings, subscribeSettings, type Settings} from '@/lib/settings';

const SERVER_SNAPSHOT: Settings = {theme: 'system', notifications: true, browseDefaults: BROWSE_DEFAULTS};

export function useSettings(): Settings {
    return useSyncExternalStore(subscribeSettings, getSettings, () => SERVER_SNAPSHOT);
}
