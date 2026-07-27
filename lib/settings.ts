import {createKeyValueStore} from './storage/create-key-value-store';
import type {KeyValueStore} from './storage/key-value-store';

/**
 * User preferences that persist across launches.
 *
 * Same shape as the watchlist store: a single in-memory snapshot backed by the platform key-value
 * store, with a subscribe/get pair so React can read it through `useSyncExternalStore`.
 */

const STORE_ID = 'settings';
const THEME_KEY = 'theme';
const NOTIFICATIONS_KEY = 'notifications';

export type ThemePreference = 'system' | 'light' | 'dark';

export interface Settings {
    theme: ThemePreference;
    /** Whether the new-movie check is allowed to notify. */
    notifications: boolean;
}

const DEFAULTS: Settings = {theme: 'system', notifications: true};

let store: KeyValueStore | null = null;
function getStore(): KeyValueStore {
    if (!store) store = createKeyValueStore(STORE_ID);
    return store;
}

let snapshot: Settings | null = null;
const listeners = new Set<() => void>();

function isThemePreference(value: string | undefined): value is ThemePreference {
    return value === 'system' || value === 'light' || value === 'dark';
}

function read(): Settings {
    if (snapshot) return snapshot;
    const s = getStore();
    const theme = s.getString(THEME_KEY);
    snapshot = {
        theme: isThemePreference(theme) ? theme : DEFAULTS.theme,
        // Absent means "never set", which is on — the app asks for permission before it can
        // actually notify, so defaulting to on is not the same as notifying uninvited.
        notifications: s.getString(NOTIFICATIONS_KEY) !== 'false',
    };
    return snapshot;
}

function write(next: Settings): void {
    snapshot = next;
    const s = getStore();
    s.set(THEME_KEY, next.theme);
    s.set(NOTIFICATIONS_KEY, next.notifications ? 'true' : 'false');
    listeners.forEach((listener) => listener());
}

export function getSettings(): Settings {
    return read();
}

export function setThemePreference(theme: ThemePreference): void {
    if (read().theme === theme) return;
    write({...read(), theme});
}

export function setNotificationsEnabled(notifications: boolean): void {
    if (read().notifications === notifications) return;
    write({...read(), notifications});
}

/** Read outside React — the background check consults this before notifying. */
export function areNotificationsEnabled(): boolean {
    return read().notifications;
}

export function subscribeSettings(listener: () => void): () => void {
    listeners.add(listener);
    return () => {
        listeners.delete(listener);
    };
}
