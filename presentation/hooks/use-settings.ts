import {useSyncExternalStore} from 'react';
import {getSettings, subscribeSettings, type Settings} from '@/lib/settings';

const SERVER_SNAPSHOT: Settings = {theme: 'system', notifications: true};

export function useSettings(): Settings {
    return useSyncExternalStore(subscribeSettings, getSettings, () => SERVER_SNAPSHOT);
}
