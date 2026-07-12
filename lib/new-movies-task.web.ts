import {router} from 'expo-router';

import {MovieRepositoryImpl, YtsApiDataSource} from '@/data';
import type {Movie} from '@/domain';
import {Quality} from '@/presentation/movies/constants/movieFilterOptions';
import {getApiBaseUrl} from '@/lib/remote-config';
import {buildNotificationContent, selectNewMovies, type NewMoviesNotification} from '@/lib/new-movies-diff';
import {NewMoviesCache} from '@/lib/new-movies-cache';
import {createLocalStorageStore} from '@/lib/storage/local-storage-key-value-store';


export const NEW_MOVIES_TASK = 'yify-new-movies-check';

export {buildNotificationContent, selectNewMovies} from '@/lib/new-movies-diff';
export type {NewMoviesNotification} from '@/lib/new-movies-diff';

const PAGE_SIZE = 50;
const DEFAULT_QUALITY = Quality.P2160;

const cache = new NewMoviesCache(createLocalStorageStore('new-movies'));

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
    const api = new YtsApiDataSource(getApiBaseUrl);
    const repository = new MovieRepositoryImpl(api);
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
    if (!hasNotificationApi() || Notification.permission !== 'granted') return 0;

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
