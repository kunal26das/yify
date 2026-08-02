import Constants from 'expo-constants';
import {useCallback, useMemo, useState} from 'react';
import {Platform} from 'react-native';
import {Analytics} from '@/presentation/analytics/events';

import type {BrowseDefaults, Preferences, ThemePreference} from '@/domain';
import {
    useNewMoviesNotifier,
    usePreferencesRepository,
    useSearchHistory,
    useWatchlistRepository,
} from '../di/DependenciesContext';
import {usePreferences} from '../hooks/use-preferences';
import {useWatchlist} from './useWatchlist';

export interface AppInfo {
    version: string;
}

export function usePreferencesViewModel() {
    const preferences: Preferences = usePreferences();
    const watchlist = useWatchlist();

    const [permissionBlocked, setPermissionBlocked] = useState(false);
    const [listCleared, setListCleared] = useState(false);
    const searchHistory = useSearchHistory();
    const newMovies = useNewMoviesNotifier();
    const preferencesRepository = usePreferencesRepository();
    const watchlistRepository = useWatchlistRepository();
    const [searchCount, setSearchCount] = useState(() => searchHistory.getRecent().length);

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
        preferencesRepository.setTheme(theme);
    }, [preferencesRepository]);

    const setBrowseDefault = useCallback((key: keyof BrowseDefaults, value: string | number) => {
        Analytics.settingChanged(`browse_${key}`, String(value));
        preferencesRepository.setBrowseDefaults({
            ...preferencesRepository.getBrowseDefaults(),
            [key]: value,
        } as BrowseDefaults);
    }, [preferencesRepository]);

    const toggleNotifications = useCallback(async (next: boolean) => {
        Analytics.settingChanged('notifications', String(next));
        preferencesRepository.setNotificationsEnabled(next);
        if (!next) {
            setPermissionBlocked(false);
            return;
        }
        const granted = await newMovies.requestPermission();
        setPermissionBlocked(!granted);
        if (granted) void newMovies.register();
    }, [preferencesRepository, newMovies]);

    const clearSearchHistory = useCallback(() => {
        Analytics.settingChanged('search_history', 'cleared');
        searchHistory.clear();
        setSearchCount(0);
    }, [searchHistory]);

    const clearList = useCallback(() => {
        Analytics.settingChanged('watchlist', 'cleared');
        watchlistRepository.clear();
        setListCleared(true);
    }, [watchlistRepository]);

    return {
        theme: preferences.theme,
        browseDefaults: preferences.browseDefaults,
        notifications: preferences.notifications,
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

export type PreferencesViewModel = ReturnType<typeof usePreferencesViewModel>;
