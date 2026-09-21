import {router} from 'expo-router';
import type {AnalyticsSink, Diagnostics, NetworkMonitor, NewMoviesNotification, NewMoviesNotifier, Preferences, Quality} from '@/domain';
import {isWithinQuietHours, localNotificationDateKey, movieNotificationTarget} from '@/domain';
import {PreferencesRepositoryImpl} from '../repositories/PreferencesRepositoryImpl';
import {WatchlistRepositoryImpl} from '../repositories/WatchlistRepositoryImpl';
import {LibraryRepositoryImpl} from '../repositories/LibraryRepositoryImpl';
import {PersistentCache} from '../datasources/storage/PersistentCache';
import {WebMovieRepositoryImpl} from '../repositories/WebMovieRepositoryImpl';
import {WebCatalogClient} from '../datasources/WebCatalogClient';
import {NOOP_DIAGNOSTICS} from './NoopDiagnostics';
import {MovieNotificationCoordinator, type ScheduledMovieNotification} from './MovieNotificationCoordinator';

let diagnostics: Diagnostics = NOOP_DIAGNOSTICS;
let network: NetworkMonitor | undefined;
let analytics: AnalyticsSink | undefined;
export const NEW_MOVIES_TASK = 'yify-new-movies-check';
const settingsStore = new PersistentCache('settings');
const deliveryStore = new PersistentCache('notification-delivery');
const timers = new Map<string, ReturnType<typeof setTimeout>>();

interface DesktopBridge {
    setNotificationSettings?: (value: string) => void;
}

function currentPreferences(): Preferences {
    return new PreferencesRepositoryImpl(settingsStore).getPreferences();
}

function hasNotificationApi(): boolean {
    return typeof window !== 'undefined' && typeof Notification !== 'undefined';
}

export async function notificationPermissionStatus(): Promise<'granted' | 'undetermined' | 'denied' | 'unavailable'> {
    if (!hasNotificationApi()) return 'unavailable';
    return Notification.permission === 'default' ? 'undetermined' : Notification.permission;
}

export async function hasNotificationPermission(): Promise<boolean> {
    return await notificationPermissionStatus() === 'granted';
}

export async function requestNotificationPermission(): Promise<boolean> {
    if (!hasNotificationApi()) return false;
    if (Notification.permission === 'granted') return true;
    if (Notification.permission === 'denied') return false;
    try { return (await Notification.requestPermission()) === 'granted'; } catch { return false; }
}

function navigateToNotification(data: NewMoviesNotification['data']): void {
    const target = movieNotificationTarget(data);
    if (!target) return;
    analytics?.trackEvent('notification_open', {notification_kind: target.kind, ...(target.movieId ? {movie_id: target.movieId} : {})});
    if (target.movieId) router.push(`/movie/${target.movieId}`);
    else router.push('/movies');
}

function deliver(item: ScheduledMovieNotification): void {
    if (!hasNotificationApi() || Notification.permission !== 'granted') return;
    const {notifications, notify} = currentPreferences();
    const daily = 'kind' in item.content.data && item.content.data.kind === 'daily-pick';
    if (!daily && (window as unknown as {yifyDesktop?: DesktopBridge}).yifyDesktop) return;
    const now = new Date();
    if (!notifications || (daily && (!notify.dailyPicks || document.visibilityState === 'visible'))) return;
    if (notify.quietHours && isWithinQuietHours(now, notify.quietStartHour, notify.quietEndHour)) return;
    if (item.date && localNotificationDateKey(item.date) !== localNotificationDateKey(now)) return;
    const key = daily ? 'last-daily-date' : 'last-arrival-id';
    const value = daily ? localNotificationDateKey(now) : item.identifier;
    if (deliveryStore.getString(key) === value) return;
    const notification = new Notification(item.content.title, {body: item.content.body, tag: item.identifier, silent: true});
    deliveryStore.set(key, value);
    notification.onclick = () => {
        window.focus();
        navigateToNotification(item.content.data);
        notification.close();
    };
}

function cancel(id: string): void {
    const timer = timers.get(id);
    if (timer !== undefined) clearTimeout(timer);
    timers.delete(id);
}

const coordinator = new MovieNotificationCoordinator({
    store: new PersistentCache('new-movies'),
    preferences: currentPreferences,
    fetchMovies: async (quality: Quality) => {
        const repository = new WebMovieRepositoryImpl(new WebCatalogClient(diagnostics, undefined, undefined, network));
        return (await repository.listMovies({page: 1, limit: 50, quality})).movies;
    },
    watchlist: () => new WatchlistRepositoryImpl(new PersistentCache('watchlist')).getAll(),
    watched: () => new LibraryRepositoryImpl(new PersistentCache('library')),
    delivery: {
        hasPermission: hasNotificationPermission,
        pending: async () => [...timers.keys()],
        cancel: async id => cancel(id),
        schedule: async item => {
            cancel(item.identifier);
            if (!item.date) { deliver(item); return; }
            const timer = setTimeout(() => {
                timers.delete(item.identifier);
                try { deliver(item); } catch (error) { diagnostics.capture(error, 'notifications.check'); }
            }, Math.max(0, item.date.getTime() - Date.now()));
            timers.set(item.identifier, timer);
        },
    },
});

let listenersBound = false;
let settingsSignature: string | undefined;

function reportFailure(error: unknown): void {
    diagnostics.capture(error, 'notifications.register');
}

export function publishNotificationSettings(preferences: Preferences): void {
    if (typeof window === 'undefined') return;
    const signature = JSON.stringify({enabled: preferences.notifications, ...preferences.notify});
    const bridge = (window as unknown as {yifyDesktop?: DesktopBridge}).yifyDesktop;
    bridge?.setNotificationSettings?.(JSON.stringify({
        enabled: preferences.notifications,
        ...preferences.notify,
        rendererDailyDelivery: hasNotificationApi() && Notification.permission === 'granted',
    }));
    if (signature === settingsSignature) return;
    settingsSignature = signature;
    coordinator.invalidate();
    void coordinator.refresh().catch(reportFailure);
}

export function refreshMovieNotificationContent(): void {
    if (typeof window === 'undefined') return;
    coordinator.invalidate();
    void coordinator.refresh().catch(reportFailure);
}

export async function checkForNewMovies(force = false): Promise<number> {
    const span = diagnostics.start('notifications.check', {forced: force});
    try {
        const count = await coordinator.check(force);
        span.finish(count > 0 ? 'ok' : 'empty');
        return count;
    } catch (error) { span.fail(error); throw error; }
}

export async function registerNewMoviesTask(): Promise<void> {
    if (typeof document === 'undefined') return;
    publishNotificationSettings(currentPreferences());
    if (!listenersBound) {
        listenersBound = true;
        const active = () => {
            if (document.visibilityState === 'visible') void coordinator.refresh(true).catch(reportFailure);
        };
        document.addEventListener('visibilitychange', active);
        window.addEventListener('focus', active);
        window.addEventListener('storage', event => {
            if (event.key === null || /^(settings|watchlist|library):/.test(event.key)) {
                coordinator.invalidate();
                void coordinator.refresh().catch(reportFailure);
            }
        });
        setInterval(() => {
            void coordinator.refresh(document.visibilityState === 'visible').catch(reportFailure);
        }, 60 * 60 * 1000);
    }
    await coordinator.refresh(document.visibilityState === 'visible');
}

export class NewMoviesNotifierImpl implements NewMoviesNotifier {
    constructor(implementation: Diagnostics = NOOP_DIAGNOSTICS, tracking?: AnalyticsSink, connectivity?: NetworkMonitor) {
        diagnostics = implementation;
        network = connectivity;
        analytics = tracking;
    }
    hasPermission() { return hasNotificationPermission(); }
    permissionStatus() { return notificationPermissionStatus(); }
    requestPermission() { return requestNotificationPermission(); }
    register() { return registerNewMoviesTask(); }
    check(force = false) { return checkForNewMovies(force); }
}
