export const NEW_MOVIES_TASK = 'yify-new-movies-check';

export {buildNotificationContent, selectNewMovies} from '@/lib/new-movies-diff';
export type {NewMoviesNotification} from '@/lib/new-movies-diff';

export async function requestNotificationPermission(): Promise<boolean> {
    return false;
}

export async function checkForNewMovies(_force = false): Promise<number> {
    return 0;
}

export async function registerNewMoviesTask(): Promise<void> {
}
