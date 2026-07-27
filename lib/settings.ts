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
const LANDING_KEY = 'landing';

export type ThemePreference = 'system' | 'light' | 'dark';
/** Mirrors DestinationKey; kept as a plain union so lib/ doesn't reach into presentation/. */
export type LandingPage = 'home' | 'movies' | 'new' | 'my-list';

export interface Settings {
    theme: ThemePreference;
    /** Whether the new-movie check is allowed to notify. */
    notifications: boolean;
    /** The screen the app opens on. */
    landingPage: LandingPage;
}

const DEFAULTS: Settings = {theme: 'system', notifications: true, landingPage: 'home'};

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

function isLandingPage(value: string | undefined): value is LandingPage {
    return value === 'home' || value === 'movies' || value === 'new' || value === 'my-list';
}

function read(): Settings {
    if (snapshot) return snapshot;
    const s = getStore();
    const theme = s.getString(THEME_KEY);
    const landing = s.getString(LANDING_KEY);
    snapshot = {
        theme: isThemePreference(theme) ? theme : DEFAULTS.theme,
        landingPage: isLandingPage(landing) ? landing : DEFAULTS.landingPage,
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
    s.set(LANDING_KEY, next.landingPage);
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

export function setLandingPage(landingPage: LandingPage): void {
    if (read().landingPage === landingPage) return;
    write({...read(), landingPage});
}

/** Read outside React — the entry route consults this once on launch. */
export function getLandingPage(): LandingPage {
    return read().landingPage;
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
