import * as BackgroundTask from 'expo-background-task';
import * as Notifications from 'expo-notifications';
import * as TaskManager from 'expo-task-manager';
import {AppState, Platform} from 'react-native';

import type {AnalyticsSink, Diagnostics, NewMoviesNotifier, Preferences, Quality} from '@/domain';
import {isWithinQuietHours} from '@/domain';
import {PreferencesRepositoryImpl} from '../repositories/PreferencesRepositoryImpl';
import {WatchlistRepositoryImpl} from '../repositories/WatchlistRepositoryImpl';
import {LibraryRepositoryImpl} from '../repositories/LibraryRepositoryImpl';
import {PersistentCache} from '../datasources/storage/PersistentCache';
import {MovieRepositoryImpl} from '../repositories/MovieRepositoryImpl';
import {YtsApiDataSource} from '../datasources/YtsApiDataSource';
import {RemoteAppConfig} from './RemoteAppConfig';
import {NOOP_DIAGNOSTICS} from './NoopDiagnostics';
import {MovieNotificationCoordinator} from './MovieNotificationCoordinator';

let diagnostics: Diagnostics = NOOP_DIAGNOSTICS;
export const NEW_MOVIES_TASK = 'yify-new-movies-check';
const CHANNEL = 'movie-recommendations';
const appConfig = new RemoteAppConfig();
const settingsStore = new PersistentCache('settings');

function currentPreferences(): Preferences {
    return new PreferencesRepositoryImpl(settingsStore).getPreferences();
}

async function ensureChannel(): Promise<void> {
    if (Platform.OS !== 'android') return;
    await Notifications.setNotificationChannelAsync(CHANNEL, {
        name: 'Movie recommendations',
        importance: Notifications.AndroidImportance.DEFAULT,
        sound: null,
        enableVibrate: false,
    });
}

export async function notificationPermissionStatus(): Promise<'granted' | 'undetermined' | 'denied'> {
    const permissions = await Notifications.getPermissionsAsync();
    if (permissions.granted || permissions.status === 'granted' ||
        permissions.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL ||
        permissions.ios?.status === Notifications.IosAuthorizationStatus.EPHEMERAL) return 'granted';
    return permissions.status === 'denied' ? 'denied' : 'undetermined';
}

export async function hasNotificationPermission(): Promise<boolean> {
    return await notificationPermissionStatus() === 'granted';
}

export async function requestNotificationPermission(): Promise<boolean> {
    await ensureChannel();
    if (await hasNotificationPermission()) return true;
    const permissions = await Notifications.getPermissionsAsync();
    if (!permissions.canAskAgain) return false;
    await Notifications.requestPermissionsAsync({ios: {allowAlert: true, allowBadge: false, allowSound: false}});
    return hasNotificationPermission();
}

function owned(request: Notifications.NotificationRequest): boolean {
    if (/^yify-(daily-pick|new-movies):/.test(request.identifier)) return true;
    const data = request.content.data;
    return (request.content.title === 'New movie added' || /^\d+ new movies$/.test(request.content.title ?? '')) &&
        (typeof data?.movieId === 'number' || typeof data?.count === 'number');
}

async function fetchMovies(quality: Quality) {
    await appConfig.ready();
    const repository = new MovieRepositoryImpl(new YtsApiDataSource(() => appConfig.getApiBaseUrl(), diagnostics));
    return (await repository.listMovies({page: 1, limit: 50, quality})).movies;
}

const coordinator = new MovieNotificationCoordinator({
    store: new PersistentCache('new-movies'),
    preferences: currentPreferences,
    fetchMovies,
    watchlist: () => new WatchlistRepositoryImpl(new PersistentCache('watchlist')).getAll(),
    watched: () => new LibraryRepositoryImpl(new PersistentCache('library')),
    delivery: {
        hasPermission: hasNotificationPermission,
        pending: async () => (await Notifications.getAllScheduledNotificationsAsync()).filter(owned).map(item => item.identifier),
        cancel: id => Notifications.cancelScheduledNotificationAsync(id),
        schedule: async item => {
            await ensureChannel();
            await Notifications.scheduleNotificationAsync({
                identifier: item.identifier,
                content: {...item.content, sound: false},
                trigger: item.date
                    ? {type: Notifications.SchedulableTriggerInputTypes.DATE, date: item.date, channelId: CHANNEL}
                    : {channelId: CHANNEL},
            });
        },
    },
});

Notifications.setNotificationHandler({
    handleNotification: async notification => {
        const preferences = currentPreferences();
        const notify = preferences.notify;
        const daily = notification.request.content.data?.kind === 'daily-pick';
        const show = preferences.notifications && !(daily && AppState.currentState === 'active') &&
            !(notify.quietHours && isWithinQuietHours(new Date(), notify.quietStartHour, notify.quietEndHour));
        return {shouldShowBanner: show, shouldShowList: show, shouldPlaySound: false, shouldSetBadge: false};
    },
});

let settingsSignature: string | undefined;
let foregroundBound = false;
let registration = Promise.resolve();

async function syncRegistration(): Promise<void> {
    const next = registration.catch(() => {}).then(async () => {
        const enabled = currentPreferences().notifications && await hasNotificationPermission();
        const registered = await TaskManager.isTaskRegisteredAsync(NEW_MOVIES_TASK);
        if (!enabled) {
            if (registered) await BackgroundTask.unregisterTaskAsync(NEW_MOVIES_TASK);
            return;
        }
        if (await BackgroundTask.getStatusAsync() === BackgroundTask.BackgroundTaskStatus.Restricted) return;
        if (!registered) await BackgroundTask.registerTaskAsync(NEW_MOVIES_TASK, {minimumInterval: 12 * 60});
    });
    registration = next;
    return next;
}

function reportFailure(error: unknown): void {
    diagnostics.capture(error, 'notifications.register');
}

export function publishNotificationSettings(preferences: Preferences): void {
    const signature = JSON.stringify({enabled: preferences.notifications, ...preferences.notify});
    if (signature === settingsSignature) return;
    settingsSignature = signature;
    coordinator.invalidate();
    void coordinator.refresh().catch(reportFailure);
    void syncRegistration().catch(reportFailure);
}

export function refreshMovieNotificationContent(): void {
    coordinator.invalidate();
    void coordinator.refresh().catch(reportFailure);
}

export async function checkForNewMovies(force = false): Promise<number> {
    const span = diagnostics.start('notifications.check', {forced: force});
    try {
        const count = await coordinator.check(force);
        span.finish(count > 0 ? 'ok' : 'empty');
        return count;
    } catch (error) {
        span.fail(error);
        throw error;
    }
}

TaskManager.defineTask(NEW_MOVIES_TASK, async () => {
    try {
        await checkForNewMovies();
        return BackgroundTask.BackgroundTaskResult.Success;
    } catch {
        return BackgroundTask.BackgroundTaskResult.Failed;
    }
});

export async function registerNewMoviesTask(): Promise<void> {
    if (!foregroundBound) {
        foregroundBound = true;
        AppState.addEventListener('change', state => {
            if (state !== 'active') return;
            void coordinator.refresh(true).catch(reportFailure);
            void syncRegistration().catch(reportFailure);
        });
    }
    await coordinator.refresh(AppState.currentState === 'active');
    await syncRegistration();
}

export class NewMoviesNotifierImpl implements NewMoviesNotifier {
    constructor(implementation: Diagnostics = NOOP_DIAGNOSTICS, _tracking?: AnalyticsSink) {
        diagnostics = implementation;
    }

    hasPermission() { return hasNotificationPermission(); }
    permissionStatus() { return notificationPermissionStatus(); }
    requestPermission() { return requestNotificationPermission(); }
    register() { return registerNewMoviesTask(); }
    check(force = false) { return checkForNewMovies(force); }
}
