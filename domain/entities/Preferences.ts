import {Genre, OrderBy, Quality, SortBy} from './MovieQuery';

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
    browseDefaults: BrowseDefaults;
}

export interface SyncedPreferences {
    theme: ThemePreference;
    notifications: boolean;
    browseDefaults: BrowseDefaults;
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
    browseDefaults: DEFAULT_BROWSE_DEFAULTS,
};
