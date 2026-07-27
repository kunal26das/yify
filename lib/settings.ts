import {createKeyValueStore} from './storage/create-key-value-store';
import type {KeyValueStore} from './storage/key-value-store';


const STORE_ID = 'settings';
const THEME_KEY = 'theme';
const NOTIFICATIONS_KEY = 'notifications';
const LANDING_KEY = 'landing';

export type ThemePreference = 'system' | 'light' | 'dark';
export type LandingPage = 'home' | 'movies' | 'new' | 'my-list';

export interface Settings {
    theme: ThemePreference;
    notifications: boolean;
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

export function getLandingPage(): LandingPage {
    return read().landingPage;
}

export function areNotificationsEnabled(): boolean {
    return read().notifications;
}

export function subscribeSettings(listener: () => void): () => void {
    listeners.add(listener);
    return () => {
        listeners.delete(listener);
    };
}
