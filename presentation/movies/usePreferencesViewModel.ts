import Constants from 'expo-constants';
import {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {AppState, Platform} from 'react-native';
import {Analytics} from '@/presentation/analytics/events';

import type {
    BrowseDefaults,
    NotificationPreferences,
    PlaybackPreferences,
    Preferences,
    ThemePreference,
} from '@/domain';
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

const PLAYBACK_EVENTS: Record<keyof PlaybackPreferences, string> = {
    autoplayTrailers: 'playback_autoplay_trailers',
    trailerCaptions: 'playback_trailer_captions',
    autoplayNext: 'playback_autoplay_next',
    miniPlayer: 'playback_mini_player',
};

const NOTIFY_EVENTS: Record<keyof NotificationPreferences, string> = {
    dailyPicks: 'notifications_daily_picks',
    dailyHour: 'notifications_daily_hour',
    quality: 'notifications_quality',
    minimumRating: 'notifications_minimum_rating',
    genre: 'notifications_genre',
    quietHours: 'notifications_quiet_hours',
    quietStartHour: 'notifications_quiet_start',
    quietEndHour: 'notifications_quiet_end',
    perTitle: 'notifications_per_title',
};

export function usePreferencesViewModel() {
    const preferences: Preferences = usePreferences();
    const watchlist = useWatchlist();

    const [permissionStatus, setPermissionStatus] = useState<'granted' | 'undetermined' | 'denied' | 'unavailable' | null>(null);
    const [notificationError, setNotificationError] = useState<string | null>(null);
    const permissionRead = useRef(0);
    const [listCleared, setListCleared] = useState(false);
    const searchHistory = useSearchHistory();
    const newMovies = useNewMoviesNotifier();
    const preferencesRepository = usePreferencesRepository();
    const watchlistRepository = useWatchlistRepository();
    const [searchCount, setSearchCount] = useState(() =>
        Platform.OS === 'web' ? 0 : searchHistory.getRecent().length
    );
    useEffect(() => {
        setSearchCount(searchHistory.getRecent().length);
    }, [searchHistory]);

    useEffect(() => {
        let active = true;
        const refreshPermission = async () => {
            const read = ++permissionRead.current;
            try {
                const status = newMovies.permissionStatus
                    ? await newMovies.permissionStatus()
                    : await newMovies.hasPermission() ? 'granted' : 'undetermined';
                if (active && read === permissionRead.current) setPermissionStatus(status);
            } catch {
            }
        };
        void refreshPermission();
        const subscription = AppState.addEventListener('change', state => {
            if (state === 'active') void refreshPermission();
        });
        return () => {
            active = false;
            permissionRead.current += 1;
            subscription.remove();
        };
    }, [newMovies]);

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

    const setPlaybackPreference = useCallback(
        <K extends keyof PlaybackPreferences>(key: K, value: PlaybackPreferences[K]) => {
            Analytics.settingChanged(PLAYBACK_EVENTS[key], String(value));
            preferencesRepository.setPlaybackPreferences({
                ...preferencesRepository.getPlaybackPreferences(),
                [key]: value,
            });
        },
        [preferencesRepository]
    );

    const setNotificationPreference = useCallback(
        <K extends keyof NotificationPreferences>(key: K, value: NotificationPreferences[K]) => {
            Analytics.settingChanged(NOTIFY_EVENTS[key], String(value));
            preferencesRepository.setNotificationPreferences({
                ...preferencesRepository.getNotificationPreferences(),
                [key]: value,
            });
        },
        [preferencesRepository]
    );

    const toggleNotifications = useCallback(async (next: boolean) => {
        Analytics.settingChanged('notifications', String(next));
        preferencesRepository.setNotificationsEnabled(next);
        setNotificationError(null);
        const read = ++permissionRead.current;
        if (!next) return;
        try {
            const granted = await newMovies.requestPermission();
            const status = granted ? 'granted' : newMovies.permissionStatus
                ? await newMovies.permissionStatus()
                : 'undetermined';
            if (read === permissionRead.current) setPermissionStatus(status);
            if (granted && preferencesRepository.areNotificationsEnabled()) await newMovies.register();
        } catch {
            if (read === permissionRead.current) {
                setNotificationError('Could not enable alerts. Please try again.');
            }
        }
    }, [preferencesRepository, newMovies]);

    const toggleConfirmWatchlistRemoval = useCallback((next: boolean) => {
        Analytics.settingChanged('confirm_watchlist_removal', String(next));
        preferencesRepository.setConfirmWatchlistRemoval(next);
    }, [preferencesRepository]);

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
        playback: preferences.playback,
        notify: preferences.notify,
        confirmWatchlistRemoval: preferences.confirmWatchlistRemoval,
        permissionBlocked: permissionStatus === 'denied',
        permissionStatus,
        notificationError,
        watchlistCount: watchlist.length,
        searchHistoryCount: searchCount,
        listCleared,
        appInfo,
        selectTheme,
        setBrowseDefault,
        setPlaybackPreference,
        setNotificationPreference,
        toggleNotifications,
        toggleConfirmWatchlistRemoval,
        clearList,
        clearSearchHistory,
    };
}

export type PreferencesViewModel = ReturnType<typeof usePreferencesViewModel>;
