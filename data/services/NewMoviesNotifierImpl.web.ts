import {router} from 'expo-router';


import type {Movie, NewMoviesNotifier, Preferences} from '@/domain';
import {
    DEFAULT_NOTIFICATION_PREFERENCES,
    NOTIFICATION_BURST_LIMIT,
    Quality,
    buildNotificationBatch,
    filterNotifiableMovies,
    isWithinQuietHours,
    notificationQuerySignature,
    selectNewMovies,
} from '@/domain';
import type {NewMoviesNotification} from '@/domain';

import {SeenMoviesRepositoryImpl} from '../repositories/SeenMoviesRepositoryImpl';
import {PreferencesRepositoryImpl} from '../repositories/PreferencesRepositoryImpl';
import {PersistentCache} from '../datasources/storage/PersistentCache';
import {MovieRepositoryImpl} from '../repositories/MovieRepositoryImpl';
import {YtsApiDataSource} from '../datasources/YtsApiDataSource';
import {RemoteAppConfig} from './RemoteAppConfig';


export const NEW_MOVIES_TASK = 'yify-new-movies-check';


const PAGE_SIZE = 50;

const cache = new SeenMoviesRepositoryImpl(new PersistentCache('new-movies'));
const appConfig = new RemoteAppConfig();
const settingsStore = new PersistentCache('settings');

interface DesktopBridge {
    setNotificationSettings?: (value: string) => void;
}

function currentPreferences(): Preferences {
    return new PreferencesRepositoryImpl(settingsStore).getPreferences();
}

export function publishNotificationSettings(preferences: Preferences): void {
    if (typeof window === 'undefined') return;
    const bridge = (window as unknown as {yifyDesktop?: DesktopBridge}).yifyDesktop;
    bridge?.setNotificationSettings?.(
        JSON.stringify({enabled: preferences.notifications, ...preferences.notify})
    );
}

function hasNotificationApi(): boolean {
    return typeof window !== 'undefined' && 'Notification' in window;
}

function localDateKey(date: Date): string {
    const y = date.getFullYear();
    const m = `${date.getMonth() + 1}`.padStart(2, '0');
    const d = `${date.getDate()}`.padStart(2, '0');
    return `${y}-${m}-${d}`;
}

async function fetchFirstPage(quality: Quality): Promise<Movie[]> {
    await appConfig.ready();
    const repository = new MovieRepositoryImpl(
        new YtsApiDataSource(() => appConfig.getApiBaseUrl())
    );
    const result = await repository.listMovies({
        page: 1,
        limit: PAGE_SIZE,
        quality,
    });
    return result.movies;
}

function navigateToNotification(data: NewMoviesNotification['data']): void {
    if ('movieId' in data) {
        router.push(`/movie/${data.movieId}`);
    }
}

function showWebNotification(content: NewMoviesNotification): void {
    if (!hasNotificationApi() || Notification.permission !== 'granted') return;
    const notification = new Notification(content.title, {body: content.body});
    notification.onclick = () => {
        window.focus();
        navigateToNotification(content.data);
        notification.close();
    };
}

export async function hasNotificationPermission(): Promise<boolean> {
    return hasNotificationApi() && Notification.permission === 'granted';
}

export async function requestNotificationPermission(): Promise<boolean> {
    if (!hasNotificationApi()) return false;
    if (Notification.permission === 'granted') return true;
    if (Notification.permission === 'denied') return false;
    try {
        return (await Notification.requestPermission()) === 'granted';
    } catch {
        return false;
    }
}

export async function checkForNewMovies(force = false): Promise<number> {
    const preferences = currentPreferences();
    publishNotificationSettings(preferences);
    if (!preferences.notifications) return 0;
    if (!hasNotificationApi() || Notification.permission !== 'granted') return 0;

    const notify = preferences.notify;
    const now = new Date();
    if (
        notify.quietHours &&
        isWithinQuietHours(now, notify.quietStartHour, notify.quietEndHour)
    ) {
        return 0;
    }

    const today = localDateKey(now);
    if (!force && cache.getLastRunDate() === today) {
        return 0;
    }

    const signature = notificationQuerySignature(notify.quality);
    const knownSignature =
        cache.getQuerySignature() ??
        notificationQuerySignature(DEFAULT_NOTIFICATION_PREFERENCES.quality);
    if (knownSignature !== signature) {
        cache.setSeenIds([]);
    }
    cache.setQuerySignature(signature);

    const movies = await fetchFirstPage(notify.quality);
    const cachedIds = cache.getSeenIds();

    cache.setLastRunDate(today);

    if (cachedIds.size === 0) {
        cache.setSeenIds(movies.map((m) => m.id));
        return 0;
    }

    const fresh = selectNewMovies(cachedIds, movies);
    cache.setSeenIds(movies.map((m) => m.id));

    const matched = filterNotifiableMovies(fresh, {
        minimumRating: notify.minimumRating,
        genre: notify.genre,
    });
    if (matched.length === 0) return 0;

    buildNotificationBatch(matched, notify.perTitle, NOTIFICATION_BURST_LIMIT).forEach(
        showWebNotification
    );
    return matched.length;
}

let listenersBound = false;

export async function registerNewMoviesTask(): Promise<void> {
    if (typeof document === 'undefined') return;

    publishNotificationSettings(currentPreferences());
    void checkForNewMovies();

    if (listenersBound) return;
    listenersBound = true;
    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') {
            void checkForNewMovies();
        }
    });
}

export class NewMoviesNotifierImpl implements NewMoviesNotifier {
    hasPermission(): Promise<boolean> {
        return hasNotificationPermission();
    }

    requestPermission(): Promise<boolean> {
        return requestNotificationPermission();
    }

    register(): Promise<void> {
        return registerNewMoviesTask();
    }

    check(force = false): Promise<number> {
        return checkForNewMovies(force);
    }
}
