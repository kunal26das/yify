import {Genre, OrderBy, Quality, SortBy} from './MovieQuery';
import type {NotificationPreferences} from './NotificationPreferences';
import {DEFAULT_NOTIFICATION_PREFERENCES} from './NotificationPreferences';
import type {PlaybackPreferences} from './PlaybackPreferences';
import {DEFAULT_PLAYBACK_PREFERENCES} from './PlaybackPreferences';

export type ThemePreference = 'system' | 'light' | 'dark';

export interface BrowseDefaults {
    sort_by: SortBy;
    order_by: OrderBy;
    quality: Quality;
    genre: Genre;
    minimum_rating: number;
}

export interface Preferences {
    theme: ThemePreference;
    notifications: boolean;
    confirmWatchlistRemoval: boolean;
    historyPaused: boolean;
    browseDefaults: BrowseDefaults;
    playback: PlaybackPreferences;
    notify: NotificationPreferences;
}

export interface SyncedPreferences {
    theme: ThemePreference;
    confirmWatchlistRemoval?: boolean;
    historyPaused?: boolean;
    browseDefaults: BrowseDefaults;
    playback?: Partial<PlaybackPreferences>;
    notify?: Partial<NotificationPreferences>;
}

export const DEFAULT_BROWSE_DEFAULTS: BrowseDefaults = {
    sort_by: SortBy.DateAdded,
    order_by: OrderBy.Desc,
    quality: Quality.All,
    genre: Genre.All,
    minimum_rating: 0,
};

export const DEFAULT_PREFERENCES: Preferences = {
    theme: 'dark',
    notifications: true,
    confirmWatchlistRemoval: true,
    historyPaused: false,
    browseDefaults: DEFAULT_BROWSE_DEFAULTS,
    playback: DEFAULT_PLAYBACK_PREFERENCES,
    notify: DEFAULT_NOTIFICATION_PREFERENCES,
};
