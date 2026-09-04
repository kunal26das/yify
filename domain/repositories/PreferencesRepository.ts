import type {NotificationPreferences} from '../entities/NotificationPreferences';
import type {PlaybackPreferences} from '../entities/PlaybackPreferences';
import type {BrowseDefaults, Preferences, SyncedPreferences, ThemePreference,} from '../entities/Preferences';

export interface PreferencesRepository {
    getPreferences(): Preferences;

    getBrowseDefaults(): BrowseDefaults;

    areNotificationsEnabled(): boolean;

    getPlaybackPreferences(): PlaybackPreferences;

    getNotificationPreferences(): NotificationPreferences;

    setTheme(theme: ThemePreference): void;

    setNotificationsEnabled(enabled: boolean): void;

    setConfirmWatchlistRemoval(enabled: boolean): void;

    setHistoryPaused(paused: boolean): void;

    setBrowseDefaults(browseDefaults: BrowseDefaults): void;

    setPlaybackPreferences(playback: PlaybackPreferences): void;

    setNotificationPreferences(notify: NotificationPreferences): void;

    getSynced(): SyncedPreferences;

    getDefaultSynced(): SyncedPreferences;

    applyRemote(next: SyncedPreferences): void;

    subscribe(listener: () => void): () => void;
}
