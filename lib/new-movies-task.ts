import * as BackgroundTask from 'expo-background-task';
import * as Notifications from 'expo-notifications';
import * as TaskManager from 'expo-task-manager';

import {MovieRepositoryImpl, YtsApiDataSource} from '@/data';
import type {Movie} from '@/domain';
import {Quality} from '@/presentation/movies/constants/movieFilterOptions';
import {getApiBaseUrl} from '@/lib/remote-config';
import {buildNotificationContent, selectNewMovies} from '@/lib/new-movies-diff';
import {NewMoviesCache} from '@/lib/new-movies-cache';
import {createMmkvStore} from '@/lib/storage/mmkv-key-value-store';

export {buildNotificationContent, selectNewMovies} from '@/lib/new-movies-diff';
export type {NewMoviesNotification} from '@/lib/new-movies-diff';

const PAGE_SIZE = 50;
const DEFAULT_QUALITY = Quality.P2160;

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

const cache = new NewMoviesCache(createMmkvStore('new-movies'));

function localDateKey(date: Date): string {
    const y = date.getFullYear();
    const m = `${date.getMonth() + 1}`.padStart(2, '0');
    const d = `${date.getDate()}`.padStart(2, '0');
    return `${y}-${m}-${d}`;
}

async function fetchFirstPage(): Promise<Movie[]> {
    const api = new YtsApiDataSource(getApiBaseUrl);
    const repository = new MovieRepositoryImpl(api);
    const result = await repository.listMovies({
        page: 1,
        limit: PAGE_SIZE,
        quality: DEFAULT_QUALITY,
    });
    return result.movies;
}

async function notifyNewMovies(newMovies: Movie[]): Promise<void> {
    const content = buildNotificationContent(newMovies);
    await Notifications.scheduleNotificationAsync({content, trigger: null});
}

export async function requestNotificationPermission(): Promise<boolean> {
    const {status, canAskAgain} = await Notifications.getPermissionsAsync();
    if (status === 'granted') return true;
    if (!canAskAgain) return false;
    const {status: next} = await Notifications.requestPermissionsAsync();
    return next === 'granted';
}

export async function checkForNewMovies(force = false): Promise<number> {
    const today = localDateKey(new Date());
    if (!force && cache.getLastRunDate() === today) {
        return 0;
    }

    const movies = await fetchFirstPage();
    const cachedIds = cache.getCachedIds();

    cache.setLastRunDate(today);

    if (cachedIds.size === 0) {
        cache.setCachedIds(movies.map((m) => m.id));
        return 0;
    }

    const newMovies = selectNewMovies(cachedIds, movies);
    cache.setCachedIds(movies.map((m) => m.id));

    if (newMovies.length > 0) {
        await notifyNewMovies(newMovies);
    }
    return newMovies.length;
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
