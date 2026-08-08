import {
    DEFAULT_BROWSE_DEFAULTS,
    DEFAULT_PREFERENCES,
    Genre,
    OrderBy,
    Quality,
    SortBy,
    type BrowseDefaults,
    type KeyValueStore,
    type Preferences,
    type PreferencesRepository,
    type SyncedPreferences,
    type ThemePreference,
} from '@/domain';

const THEME_KEY = 'theme';
const NOTIFICATIONS_KEY = 'notifications';
const CONFIRM_WATCHLIST_REMOVAL_KEY = 'confirmWatchlistRemoval';
const BROWSE_DEFAULTS_KEY = 'browseDefaults';

function isThemePreference(value: unknown): value is ThemePreference {
    return value === 'system' || value === 'light' || value === 'dark';
}

function asEnum<T extends Record<string, string>>(
    value: unknown,
    members: T,
    fallback: T[keyof T]
): T[keyof T] {
    return typeof value === 'string' && Object.values(members).includes(value)
        ? (value as T[keyof T])
        : fallback;
}

function parseBrowseDefaults(raw: string | undefined): BrowseDefaults {
    if (!raw) return DEFAULT_BROWSE_DEFAULTS;
    try {
        const parsed = JSON.parse(raw) as Partial<Record<keyof BrowseDefaults, unknown>>;
        const rating = Number(parsed.minimum_rating);
        return {
            sort_by: asEnum(parsed.sort_by, SortBy, DEFAULT_BROWSE_DEFAULTS.sort_by),
            order_by: asEnum(parsed.order_by, OrderBy, DEFAULT_BROWSE_DEFAULTS.order_by),
            quality: asEnum(parsed.quality, Quality, DEFAULT_BROWSE_DEFAULTS.quality),
            genre: asEnum(parsed.genre, Genre, DEFAULT_BROWSE_DEFAULTS.genre),
            minimum_rating: Number.isFinite(rating)
                ? rating
                : DEFAULT_BROWSE_DEFAULTS.minimum_rating,
        };
    } catch {
        return DEFAULT_BROWSE_DEFAULTS;
    }
}

export function parseSyncedPreferences(raw: string): SyncedPreferences | null {
    try {
        const parsed = JSON.parse(raw) as Partial<SyncedPreferences>;
        if (typeof parsed !== 'object' || parsed == null) return null;
        return {
            theme: isThemePreference(parsed.theme) ? parsed.theme : DEFAULT_PREFERENCES.theme,
            notifications: DEFAULT_PREFERENCES.notifications,
            ...(typeof parsed.confirmWatchlistRemoval === 'boolean'
                ? {confirmWatchlistRemoval: parsed.confirmWatchlistRemoval}
                : {}),
            browseDefaults: parseBrowseDefaults(
                parsed.browseDefaults ? JSON.stringify(parsed.browseDefaults) : undefined
            ),
        };
    } catch {
        return null;
    }
}

export class PreferencesRepositoryImpl implements PreferencesRepository {
    private readonly store: KeyValueStore;
    private readonly listeners = new Set<() => void>();
    private snapshot: Preferences | null = null;

    constructor(store: KeyValueStore) {
        this.store = store;
    }

    getPreferences(): Preferences {
        return this.read();
    }

    getBrowseDefaults(): BrowseDefaults {
        return this.read().browseDefaults;
    }

    areNotificationsEnabled(): boolean {
        return this.read().notifications;
    }

    setTheme(theme: ThemePreference): void {
        if (this.read().theme === theme) return;
        this.write({...this.read(), theme});
    }

    setNotificationsEnabled(notifications: boolean): void {
        if (this.read().notifications === notifications) return;
        this.write({...this.read(), notifications});
    }

    setConfirmWatchlistRemoval(confirmWatchlistRemoval: boolean): void {
        if (this.read().confirmWatchlistRemoval === confirmWatchlistRemoval) return;
        this.write({...this.read(), confirmWatchlistRemoval});
    }

    setBrowseDefaults(browseDefaults: BrowseDefaults): void {
        this.write({...this.read(), browseDefaults});
    }

    getSynced(): SyncedPreferences {
        const current = this.read();
        return {
            theme: current.theme,
            notifications: current.notifications,
            confirmWatchlistRemoval: current.confirmWatchlistRemoval,
            browseDefaults: current.browseDefaults,
        };
    }

    getDefaultSynced(): SyncedPreferences {
        return {
            theme: DEFAULT_PREFERENCES.theme,
            notifications: DEFAULT_PREFERENCES.notifications,
            confirmWatchlistRemoval: DEFAULT_PREFERENCES.confirmWatchlistRemoval,
            browseDefaults: DEFAULT_BROWSE_DEFAULTS,
        };
    }

    applyRemote(next: SyncedPreferences): void {
        const current = this.read();
        this.write({
            ...current,
            theme: next.theme,
            confirmWatchlistRemoval:
                next.confirmWatchlistRemoval ?? current.confirmWatchlistRemoval,
            browseDefaults: next.browseDefaults,
        });
    }

    subscribe(listener: () => void): () => void {
        this.listeners.add(listener);
        return () => {
            this.listeners.delete(listener);
        };
    }

    private read(): Preferences {
        if (this.snapshot) return this.snapshot;
        const theme = this.store.getString(THEME_KEY);
        this.snapshot = {
            theme: isThemePreference(theme) ? theme : DEFAULT_PREFERENCES.theme,
            browseDefaults: parseBrowseDefaults(this.store.getString(BROWSE_DEFAULTS_KEY)),
            notifications: this.store.getString(NOTIFICATIONS_KEY) !== 'false',
            confirmWatchlistRemoval:
                this.store.getString(CONFIRM_WATCHLIST_REMOVAL_KEY) !== 'false',
        };
        return this.snapshot;
    }

    private write(next: Preferences): void {
        this.snapshot = next;
        this.store.set(THEME_KEY, next.theme);
        this.store.set(NOTIFICATIONS_KEY, next.notifications ? 'true' : 'false');
        this.store.set(
            CONFIRM_WATCHLIST_REMOVAL_KEY,
            next.confirmWatchlistRemoval ? 'true' : 'false'
        );
        this.store.set(BROWSE_DEFAULTS_KEY, JSON.stringify(next.browseDefaults));
        this.listeners.forEach((listener) => listener());
    }
}
