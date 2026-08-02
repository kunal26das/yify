import Constants from 'expo-constants';
import {useCallback, useMemo, useState} from 'react';
import {Platform} from 'react-native';
import {Analytics} from '@/lib/analytics-events';
import {registerNewMoviesTask, requestNotificationPermission} from '@/lib/new-movies-task';
import {
    getBrowseDefaults,
    setBrowseDefaults,
    setNotificationsEnabled,
    setThemePreference,
    type BrowseDefaults,
    type Settings,
    type ThemePreference,
} from '@/lib/settings';
import {clearWatchlist} from '@/lib/watchlist';
import {clearRecentSearches, getRecentSearches} from './components/SearchOverlay';
import {useSettings} from '../hooks/use-settings';
import {useWatchlist} from './useWatchlist';

export interface AppInfo {
    version: string;
}

export function useSettingsViewModel() {
    const settings: Settings = useSettings();
    const watchlist = useWatchlist();

    const [permissionBlocked, setPermissionBlocked] = useState(false);
    const [listCleared, setListCleared] = useState(false);
    const [searchCount, setSearchCount] = useState(() => getRecentSearches().length);

    const appInfo = useMemo<AppInfo>(() => {
        const build =
            Platform.OS === 'android'
                ? Constants.expoConfig?.android?.versionCode
                : Constants.expoConfig?.ios?.buildNumber;
        const version = Constants.expoConfig?.version ?? '—';
        return {version: build != null ? `${version} (${build})` : version};
    }, []);

    const selectTheme = useCallback((theme: ThemePreference) => {
        Analytics.settingChanged('theme', theme);
        setThemePreference(theme);
    }, []);

    const setBrowseDefault = useCallback((key: keyof BrowseDefaults, value: string | number) => {
        Analytics.settingChanged(`browse_${key}`, String(value));
        setBrowseDefaults({...getBrowseDefaults(), [key]: value} as BrowseDefaults);
    }, []);

    const toggleNotifications = useCallback(async (next: boolean) => {
        Analytics.settingChanged('notifications', String(next));
        setNotificationsEnabled(next);
        if (!next) {
            setPermissionBlocked(false);
            return;
        }
        const granted = await requestNotificationPermission();
        setPermissionBlocked(!granted);
        if (granted) void registerNewMoviesTask();
    }, []);

    const clearSearchHistory = useCallback(() => {
        Analytics.settingChanged('search_history', 'cleared');
        clearRecentSearches();
        setSearchCount(0);
    }, []);

    const clearList = useCallback(() => {
        Analytics.settingChanged('watchlist', 'cleared');
        clearWatchlist();
        setListCleared(true);
    }, []);

    return {
        theme: settings.theme,
        browseDefaults: settings.browseDefaults,
        notifications: settings.notifications,
        permissionBlocked,
        watchlistCount: watchlist.length,
        searchHistoryCount: searchCount,
        listCleared,
        appInfo,
        selectTheme,
        setBrowseDefault,
        toggleNotifications,
        clearList,
        clearSearchHistory,
    };
}

export type SettingsViewModel = ReturnType<typeof useSettingsViewModel>;
