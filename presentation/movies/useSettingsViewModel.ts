import Constants from 'expo-constants';
import {useCallback, useMemo, useState} from 'react';
import {Platform} from 'react-native';
import {Analytics} from '@/lib/analytics-events';
import {requestNotificationPermission} from '@/lib/new-movies-task';
import {
    setLandingPage,
    setNotificationsEnabled,
    setThemePreference,
    type LandingPage,
    type Settings,
    type ThemePreference,
} from '@/lib/settings';
import {clearWatchlist} from '@/lib/watchlist';
import {useSettings} from '../hooks/use-settings';
import {useWatchlist} from './useWatchlist';

export interface AppInfo {
    version: string;
    build: string | null;
    platform: string;
}

export function useSettingsViewModel() {
    const settings: Settings = useSettings();
    const watchlist = useWatchlist();

    const [permissionBlocked, setPermissionBlocked] = useState(false);
    const [listCleared, setListCleared] = useState(false);

    const appInfo = useMemo<AppInfo>(() => {
        const build =
            Platform.OS === 'android'
                ? Constants.expoConfig?.android?.versionCode
                : Constants.expoConfig?.ios?.buildNumber;
        return {
            version: Constants.expoConfig?.version ?? '—',
            build: build != null ? String(build) : null,
            platform: Platform.OS === 'web' ? 'Web' : Platform.OS === 'ios' ? 'iOS' : 'Android',
        };
    }, []);

    const selectTheme = useCallback((theme: ThemePreference) => {
        Analytics.settingChanged('theme', theme);
        setThemePreference(theme);
    }, []);

    const selectLandingPage = useCallback((landingPage: LandingPage) => {
        Analytics.settingChanged('landing_page', landingPage);
        setLandingPage(landingPage);
    }, []);

    const toggleNotifications = useCallback(async (next: boolean) => {
        Analytics.settingChanged('notifications', String(next));
        setNotificationsEnabled(next);
        if (!next) {
            setPermissionBlocked(false);
            return;
        }
        setPermissionBlocked(!(await requestNotificationPermission()));
    }, []);

    const clearList = useCallback(() => {
        Analytics.settingChanged('watchlist', 'cleared');
        clearWatchlist();
        setListCleared(true);
    }, []);

    return {
        theme: settings.theme,
        landingPage: settings.landingPage,
        notifications: settings.notifications,
        permissionBlocked,
        watchlistCount: watchlist.length,
        listCleared,
        appInfo,
        selectTheme,
        selectLandingPage,
        toggleNotifications,
        clearList,
    };
}

export type SettingsViewModel = ReturnType<typeof useSettingsViewModel>;
