import {useSyncExternalStore} from 'react';
import {getSettings, subscribeSettings, type Settings} from '@/lib/settings';

const SERVER_SNAPSHOT: Settings = {theme: 'system', notifications: true, landingPage: 'home'};

export function useSettings(): Settings {
    return useSyncExternalStore(subscribeSettings, getSettings, () => SERVER_SNAPSHOT);
}
