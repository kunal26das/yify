import {createKeyValueStore} from './storage/create-key-value-store';
import type {KeyValueStore} from './storage/key-value-store';


const STORE_ID = 'settings';
const THEME_KEY = 'theme';
const NOTIFICATIONS_KEY = 'notifications';
const BROWSE_DEFAULTS_KEY = 'browseDefaults';

export type ThemePreference = 'system' | 'light' | 'dark';

export interface BrowseDefaults {
    sort_by: string;
    order_by: string;
    quality: string;
    genre: string;
    minimum_rating: number;
}

export interface Settings {
    theme: ThemePreference;
    notifications: boolean;
    browseDefaults: BrowseDefaults;
}

export const BROWSE_DEFAULTS: BrowseDefaults = {
    sort_by: 'date_added',
    order_by: 'desc',
    quality: '',
    genre: '',
    minimum_rating: 0,
};

const DEFAULTS: Settings = {theme: 'dark', notifications: true, browseDefaults: BROWSE_DEFAULTS};

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

function parseBrowseDefaults(raw: string | undefined): BrowseDefaults {
    if (!raw) return BROWSE_DEFAULTS;
    try {
        const parsed = JSON.parse(raw) as Partial<BrowseDefaults>;
        const rating = Number(parsed.minimum_rating);
        return {
            sort_by: typeof parsed.sort_by === 'string' ? parsed.sort_by : BROWSE_DEFAULTS.sort_by,
            order_by: typeof parsed.order_by === 'string' ? parsed.order_by : BROWSE_DEFAULTS.order_by,
            quality: typeof parsed.quality === 'string' ? parsed.quality : BROWSE_DEFAULTS.quality,
            genre: typeof parsed.genre === 'string' ? parsed.genre : BROWSE_DEFAULTS.genre,
            minimum_rating: Number.isFinite(rating) ? rating : BROWSE_DEFAULTS.minimum_rating,
        };
    } catch {
        return BROWSE_DEFAULTS;
    }
}

function read(): Settings {
    if (snapshot) return snapshot;
    const s = getStore();
    const theme = s.getString(THEME_KEY);
    const browse = s.getString(BROWSE_DEFAULTS_KEY);
    snapshot = {
        theme: isThemePreference(theme) ? theme : DEFAULTS.theme,
        browseDefaults: parseBrowseDefaults(browse),
        notifications: s.getString(NOTIFICATIONS_KEY) !== 'false',
    };
    return snapshot;
}

function write(next: Settings): void {
    snapshot = next;
    const s = getStore();
    s.set(THEME_KEY, next.theme);
    s.set(NOTIFICATIONS_KEY, next.notifications ? 'true' : 'false');
    s.set(BROWSE_DEFAULTS_KEY, JSON.stringify(next.browseDefaults));
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

export function setBrowseDefaults(browseDefaults: BrowseDefaults): void {
    write({...read(), browseDefaults});
}

export function getBrowseDefaults(): BrowseDefaults {
    return read().browseDefaults;
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
