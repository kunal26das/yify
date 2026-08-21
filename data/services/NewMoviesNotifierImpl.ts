import * as BackgroundTask from 'expo-background-task';
import * as Notifications from 'expo-notifications';
import * as TaskManager from 'expo-task-manager';

import type {Movie, NewMoviesNotifier, NotificationPreferences, Preferences} from '@/domain';
import {
    DEFAULT_NOTIFICATION_PREFERENCES,
    NOTIFICATION_BURST_LIMIT,
    Quality,
    buildNotificationBatch,
    filterNotifiableMovies,
    notificationQuerySignature,
    quietHoursEndAt,
    selectNewMovies,
} from '@/domain';

import {SeenMoviesRepositoryImpl} from '../repositories/SeenMoviesRepositoryImpl';
import {PreferencesRepositoryImpl} from '../repositories/PreferencesRepositoryImpl';
import {PersistentCache} from '../datasources/storage/PersistentCache';
import {MovieRepositoryImpl} from '../repositories/MovieRepositoryImpl';
import {YtsApiDataSource} from '../datasources/YtsApiDataSource';
import {RemoteAppConfig} from './RemoteAppConfig';

const PAGE_SIZE = 50;

export const NEW_MOVIES_TASK = 'yify-new-movies-check';

Notifications.setNotificationHandler({
    handleNotification: async () => ({
        shouldShowBanner: true,
        shouldShowList: true,
        shouldPlaySound: false,
        shouldSetBadge: false,
    }),
});

const DAILY_INTERVAL_MINUTES = 24 * 60;

const cache = new SeenMoviesRepositoryImpl(new PersistentCache('new-movies'));

function localDateKey(date: Date): string {
    const y = date.getFullYear();
    const m = `${date.getMonth() + 1}`.padStart(2, '0');
    const d = `${date.getDate()}`.padStart(2, '0');
    return `${y}-${m}-${d}`;
}

const appConfig = new RemoteAppConfig();
const settingsStore = new PersistentCache('settings');

function currentPreferences(): Preferences {
    return new PreferencesRepositoryImpl(settingsStore).getPreferences();
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

async function notifyNewMovies(
    newMovies: Movie[],
    notify: NotificationPreferences,
    now: Date
): Promise<void> {
    const deferUntil = notify.quietHours
        ? quietHoursEndAt(now, notify.quietStartHour, notify.quietEndHour)
        : null;
    const trigger: Notifications.NotificationTriggerInput = deferUntil
        ? {type: Notifications.SchedulableTriggerInputTypes.DATE, date: deferUntil}
        : null;
    const batch = buildNotificationBatch(newMovies, notify.perTitle, NOTIFICATION_BURST_LIMIT);
    for (const content of batch) {
        await Notifications.scheduleNotificationAsync({content, trigger});
    }
}

export function publishNotificationSettings(_preferences: Preferences): void {}

export async function hasNotificationPermission(): Promise<boolean> {
    const {status} = await Notifications.getPermissionsAsync();
    return status === 'granted';
}

export async function requestNotificationPermission(): Promise<boolean> {
    const {status, canAskAgain} = await Notifications.getPermissionsAsync();
    if (status === 'granted') return true;
    if (!canAskAgain) return false;
    const {status: next} = await Notifications.requestPermissionsAsync();
    return next === 'granted';
}

export async function checkForNewMovies(force = false): Promise<number> {
    const preferences = currentPreferences();
    if (!preferences.notifications) return 0;
    const notify = preferences.notify;

    const now = new Date();
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

    await notifyNewMovies(matched, notify, now);
    return matched.length;
}

TaskManager.defineTask(NEW_MOVIES_TASK, async () => {
    try {
        await checkForNewMovies();
        return BackgroundTask.BackgroundTaskResult.Success;
    } catch (e) {
        console.warn('[new-movies] background check failed', e);
        return BackgroundTask.BackgroundTaskResult.Failed;
    }
});

export async function registerNewMoviesTask(): Promise<void> {
    try {
        const status2 = await BackgroundTask.getStatusAsync();
        if (status2 === BackgroundTask.BackgroundTaskStatus.Restricted) {
            return;
        }

        const isRegistered = await TaskManager.isTaskRegisteredAsync(NEW_MOVIES_TASK);
        if (!isRegistered) {
            await BackgroundTask.registerTaskAsync(NEW_MOVIES_TASK, {
                minimumInterval: DAILY_INTERVAL_MINUTES,
            });
        }
    } catch (e) {
        console.warn('[new-movies] failed to register background task', e);
    }
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
