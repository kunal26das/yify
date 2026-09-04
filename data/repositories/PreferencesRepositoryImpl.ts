import {
    type BrowseDefaults,
    DEFAULT_BROWSE_DEFAULTS,
    DEFAULT_NOTIFICATION_PREFERENCES,
    DEFAULT_PLAYBACK_PREFERENCES,
    DEFAULT_PREFERENCES,
    Genre,
    type KeyValueStore,
    mergeSection,
    type NotificationPreferences,
    OrderBy,
    type PlaybackPreferences,
    type Preferences,
    type PreferencesRepository,
    Quality,
    readSection,
    type SectionGuards,
    SortBy,
    type SyncedPreferences,
    type ThemePreference,
} from '@/domain';

const THEME_KEY = 'theme';
const NOTIFICATIONS_KEY = 'notifications';
const CONFIRM_WATCHLIST_REMOVAL_KEY = 'confirmWatchlistRemoval';
const HISTORY_PAUSED_KEY = 'historyPaused';
const BROWSE_DEFAULTS_KEY = 'browseDefaults';
const PLAYBACK_KEY = 'playback';
const NOTIFY_KEY = 'notify';

function isThemePreference(value: unknown): value is ThemePreference {
    return value === 'system' || value === 'light' || value === 'dark';
}

function isHour(value: unknown): boolean {
    return typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= 23;
}

function isMember<T extends Record<string, string>>(value: unknown, members: T): boolean {
    return typeof value === 'string' && Object.values(members).includes(value);
}

const PLAYBACK_GUARDS: SectionGuards<PlaybackPreferences> = {
    autoplayTrailers: (value) => typeof value === 'boolean',
    trailerCaptions: (value) => typeof value === 'boolean',
    autoplayNext: (value) => typeof value === 'boolean',
    miniPlayer: (value) => typeof value === 'boolean',
};

const NOTIFY_GUARDS: SectionGuards<NotificationPreferences> = {
    quality: (value) => isMember(value, Quality),
    minimumRating: (value) =>
        typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 10,
    genre: (value) => isMember(value, Genre),
    quietHours: (value) => typeof value === 'boolean',
    quietStartHour: isHour,
    quietEndHour: isHour,
    perTitle: (value) => typeof value === 'boolean',
};

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

function parseLocalSection<T>(raw: string | undefined, guards: SectionGuards<T>, fallback: T): T {
    if (!raw) return fallback;
    try {
        return mergeSection(fallback, readSection<T>(JSON.parse(raw) as unknown, guards));
    } catch {
        return fallback;
    }
}

export function parseSyncedPreferences(raw: string): SyncedPreferences | null {
    try {
        const parsed = JSON.parse(raw) as Partial<SyncedPreferences>;
        if (typeof parsed !== 'object' || parsed == null) return null;
        const playback = readSection<PlaybackPreferences>(parsed.playback, PLAYBACK_GUARDS);
        const notify = readSection<NotificationPreferences>(parsed.notify, NOTIFY_GUARDS);
        return {
            theme: isThemePreference(parsed.theme) ? parsed.theme : DEFAULT_PREFERENCES.theme,
            ...(typeof parsed.confirmWatchlistRemoval === 'boolean'
                ? {confirmWatchlistRemoval: parsed.confirmWatchlistRemoval}
                : {}),
            ...(typeof parsed.historyPaused === 'boolean'
                ? {historyPaused: parsed.historyPaused}
                : {}),
            browseDefaults: parseBrowseDefaults(
                parsed.browseDefaults ? JSON.stringify(parsed.browseDefaults) : undefined
            ),
            ...(playback ? {playback} : {}),
            ...(notify ? {notify} : {}),
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

    getPlaybackPreferences(): PlaybackPreferences {
        return this.read().playback;
    }

    getNotificationPreferences(): NotificationPreferences {
        return this.read().notify;
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

    setHistoryPaused(historyPaused: boolean): void {
        if (this.read().historyPaused === historyPaused) return;
        this.write({...this.read(), historyPaused});
    }

    setBrowseDefaults(browseDefaults: BrowseDefaults): void {
        this.write({...this.read(), browseDefaults});
    }

    setPlaybackPreferences(playback: PlaybackPreferences): void {
        this.write({...this.read(), playback});
    }

    setNotificationPreferences(notify: NotificationPreferences): void {
        this.write({...this.read(), notify});
    }

    getSynced(): SyncedPreferences {
        const current = this.read();
        return {
            theme: current.theme,
            confirmWatchlistRemoval: current.confirmWatchlistRemoval,
            historyPaused: current.historyPaused,
            browseDefaults: current.browseDefaults,
            playback: {...current.playback},
            notify: {...current.notify},
        };
    }

    getDefaultSynced(): SyncedPreferences {
        return {
            theme: DEFAULT_PREFERENCES.theme,
            confirmWatchlistRemoval: DEFAULT_PREFERENCES.confirmWatchlistRemoval,
            historyPaused: DEFAULT_PREFERENCES.historyPaused,
            browseDefaults: DEFAULT_BROWSE_DEFAULTS,
            playback: {...DEFAULT_PLAYBACK_PREFERENCES},
            notify: {...DEFAULT_NOTIFICATION_PREFERENCES},
        };
    }

    applyRemote(next: SyncedPreferences): void {
        const current = this.read();
        this.write({
            ...current,
            theme: next.theme,
            confirmWatchlistRemoval:
                next.confirmWatchlistRemoval ?? current.confirmWatchlistRemoval,
            historyPaused: next.historyPaused ?? current.historyPaused,
            browseDefaults: next.browseDefaults,
            playback: mergeSection(current.playback, next.playback),
            notify: mergeSection(current.notify, next.notify),
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
            historyPaused: this.store.getString(HISTORY_PAUSED_KEY) === 'true',
            playback: parseLocalSection(
                this.store.getString(PLAYBACK_KEY),
                PLAYBACK_GUARDS,
                DEFAULT_PLAYBACK_PREFERENCES
            ),
            notify: parseLocalSection(
                this.store.getString(NOTIFY_KEY),
                NOTIFY_GUARDS,
                DEFAULT_NOTIFICATION_PREFERENCES
            ),
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
        this.store.set(HISTORY_PAUSED_KEY, next.historyPaused ? 'true' : 'false');
        this.store.set(BROWSE_DEFAULTS_KEY, JSON.stringify(next.browseDefaults));
        this.store.set(PLAYBACK_KEY, JSON.stringify(next.playback));
        this.store.set(NOTIFY_KEY, JSON.stringify(next.notify));
        this.listeners.forEach((listener) => listener());
    }
}
