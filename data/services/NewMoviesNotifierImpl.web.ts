import {router} from 'expo-router';


import type {Movie, NewMoviesNotifier} from '@/domain';
import {Quality, buildNotificationContent, selectNewMovies} from '@/domain';
import type {NewMoviesNotification} from '@/domain';

import {SeenMoviesRepositoryImpl} from '../repositories/SeenMoviesRepositoryImpl';
import {PreferencesRepositoryImpl} from '../repositories/PreferencesRepositoryImpl';
import {PersistentCache} from '../datasources/storage/PersistentCache';
import {MovieRepositoryImpl} from '../repositories/MovieRepositoryImpl';
import {YtsApiDataSource} from '../datasources/YtsApiDataSource';
import {RemoteAppConfig} from './RemoteAppConfig';


export const NEW_MOVIES_TASK = 'yify-new-movies-check';


const PAGE_SIZE = 50;
const DEFAULT_QUALITY = Quality.P2160;

const cache = new SeenMoviesRepositoryImpl(new PersistentCache('new-movies'));
const appConfig = new RemoteAppConfig();
const preferences = new PreferencesRepositoryImpl(new PersistentCache('settings'));

function hasNotificationApi(): boolean {
    return typeof window !== 'undefined' && 'Notification' in window;
}

function localDateKey(date: Date): string {
    const y = date.getFullYear();
    const m = `${date.getMonth() + 1}`.padStart(2, '0');
    const d = `${date.getDate()}`.padStart(2, '0');
    return `${y}-${m}-${d}`;
}

async function fetchFirstPage(): Promise<Movie[]> {
    await appConfig.ready();
    const repository = new MovieRepositoryImpl(
        new YtsApiDataSource(() => appConfig.getApiBaseUrl())
    );
    const result = await repository.listMovies({
        page: 1,
        limit: PAGE_SIZE,
        quality: DEFAULT_QUALITY,
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
    if (!preferences.areNotificationsEnabled()) return 0;
    if (!hasNotificationApi() || Notification.permission !== 'granted') return 0;

    const today = localDateKey(new Date());
    if (!force && cache.getLastRunDate() === today) {
        return 0;
    }

    const movies = await fetchFirstPage();
    const cachedIds = cache.getSeenIds();

    cache.setLastRunDate(today);

    if (cachedIds.size === 0) {
        cache.setSeenIds(movies.map((m) => m.id));
        return 0;
    }

    const newMovies = selectNewMovies(cachedIds, movies);
    cache.setSeenIds(movies.map((m) => m.id));

    if (newMovies.length > 0) {
        showWebNotification(buildNotificationContent(newMovies));
    }
    return newMovies.length;
}

let listenersBound = false;

export async function registerNewMoviesTask(): Promise<void> {
    if (typeof document === 'undefined') return;

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
