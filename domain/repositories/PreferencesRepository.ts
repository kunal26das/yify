import type {
    BrowseDefaults,
    Preferences,
    SyncedPreferences,
    ThemePreference,
} from '../entities/Preferences';

export interface PreferencesRepository {
    getPreferences(): Preferences;

    getBrowseDefaults(): BrowseDefaults;

    areNotificationsEnabled(): boolean;

    setTheme(theme: ThemePreference): void;

    setNotificationsEnabled(enabled: boolean): void;

    setBrowseDefaults(browseDefaults: BrowseDefaults): void;

    getSynced(): SyncedPreferences;

    getDefaultSynced(): SyncedPreferences;

    applyRemote(next: SyncedPreferences): void;

    subscribe(listener: () => void): () => void;
}
