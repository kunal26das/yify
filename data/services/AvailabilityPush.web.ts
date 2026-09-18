import Constants from 'expo-constants';
import type {AvailabilityPush} from '@/domain';
import type {Messaging} from 'firebase/messaging';
import {getFirebaseApp} from '../datasources/firebase/FirebaseWebApp';

function browserSupported(): boolean {
    return typeof window !== 'undefined' && window.isSecureContext === true
        && typeof navigator !== 'undefined' && 'serviceWorker' in navigator
        && typeof Notification !== 'undefined' && typeof PushManager !== 'undefined';
}

function vapidKey(): string | undefined {
    const value = process.env.EXPO_PUBLIC_FIREBASE_VAPID_KEY;
    return typeof value === 'string' && /^[A-Za-z\d_-]{87}$/.test(value) ? value : undefined;
}

function workerUrls(): {script: string; scope: string} {
    const base = Constants.expoConfig?.experiments?.baseUrl ?? '';
    if (typeof base !== 'string' || (base !== '' && base !== '/' && !/^\/(?:[A-Za-z\d_-]+\/)*[A-Za-z\d_-]+\/?$/.test(base))) {
        throw new Error('Availability notification address is not configured.');
    }
    const root = new URL((base === '/' ? '' : base.replace(/\/$/, '')) + '/', window.location.origin);
    return {script: new URL('availability-worker.js', root).href, scope: new URL('availability-push/', root).href};
}

async function activated(registration: ServiceWorkerRegistration): Promise<void> {
    if (registration.active) return;
    const worker = registration.installing ?? registration.waiting;
    if (!worker) throw new Error('Availability notification worker is unavailable.');
    await new Promise<void>((resolve, reject) => {
        const finish = (error?: Error) => {
            clearTimeout(timer);
            worker.removeEventListener('statechange', changed);
            if (error) reject(error); else resolve();
        };
        const changed = () => {
            if (worker.state === 'activated') finish();
            else if (worker.state === 'redundant') finish(new Error('Availability notification worker is unavailable.'));
        };
        const timer = setTimeout(() => finish(new Error('Availability notification worker did not start.')), 15_000);
        worker.addEventListener('statechange', changed);
        changed();
    });
}

export class AvailabilityPushImpl implements AvailabilityPush {
    private pending: Promise<unknown> = Promise.resolve();
    private messaging: Messaging | undefined;
    private revocationPending = false;

    async supported(): Promise<boolean> {
        if (!browserSupported() || !vapidKey()) return false;
        try {
            workerUrls();
            return await (await import('firebase/messaging')).isSupported();
        } catch { return false; }
    }

    private sequence<T>(action: () => Promise<T>): Promise<T> {
        const result = this.pending.catch(() => {}).then(action);
        this.pending = result;
        return result;
    }

    private async revoke(): Promise<void> {
        this.revocationPending = true;
        const urls = workerUrls();
        const registration = await navigator.serviceWorker.getRegistration(urls.scope);
        if (registration?.scope === urls.scope) {
            const script = registration.active?.scriptURL ?? registration.waiting?.scriptURL ?? registration.installing?.scriptURL;
            if (script === urls.script) {
                let failure = false;
                if (this.messaging) {
                    try { await (await import('firebase/messaging')).deleteToken(this.messaging); }
                    catch { failure = true; }
                }
                try {
                    const subscription = await registration.pushManager.getSubscription();
                    if (subscription && !await subscription.unsubscribe()) failure = true;
                }
                catch { failure = true; }
                const notifications = await registration.getNotifications();
                notifications.filter(item => item.tag.startsWith('yify-availability:')).forEach(item => item.close());
                if (failure) throw new Error('Availability notifications could not be disabled.');
                await registration.unregister();
            }
        }
        this.messaging = undefined;
        this.revocationPending = false;
    }

    register(): Promise<{kind: 'fcm'; token: string}> {
        if (!browserSupported() || !vapidKey()) return Promise.reject(new Error('Availability notifications are not supported in this browser.'));
        let permission: Promise<NotificationPermission>;
        try {
            workerUrls();
            permission = (Notification.permission === 'default' ? Notification.requestPermission() : Promise.resolve(Notification.permission))
                .catch(() => { throw new Error('Notification permission could not be requested.'); });
            permission.catch(() => {});
        } catch { return Promise.reject(new Error('Notification permission could not be requested.')); }
        return this.sequence(async () => {
            if (await permission !== 'granted') throw new Error('Allow notifications in your browser settings to receive availability alerts.');
            if (!await this.supported()) throw new Error('Availability notifications are not supported in this browser.');
            let workerRegistered = false;
            try {
                if (this.revocationPending) await this.revoke();
                const firebase = await import('firebase/messaging');
                const app = getFirebaseApp();
                if (!app) throw new Error();
                const urls = workerUrls();
                const existing = await navigator.serviceWorker.getRegistration(urls.scope);
                if (existing?.scope === urls.scope) {
                    const script = existing.active?.scriptURL ?? existing.waiting?.scriptURL ?? existing.installing?.scriptURL;
                    if (script !== urls.script) throw new Error();
                }
                const registration = await navigator.serviceWorker.register(urls.script, {scope: urls.scope});
                workerRegistered = true;
                await activated(registration);
                const messaging = firebase.getMessaging(app);
                const token = await firebase.getToken(messaging, {vapidKey: vapidKey(), serviceWorkerRegistration: registration});
                this.messaging = messaging;
                if (typeof token !== 'string' || !/^[A-Za-z\d_:\-]{20,2048}$/.test(token)) throw new Error();
                return {kind: 'fcm', token};
            } catch {
                if (workerRegistered) await this.revoke().catch(() => {});
                throw new Error('Availability notifications could not be registered.');
            }
        });
    }

    unregister(): Promise<void> {
        return this.sequence(async () => {
            if (!browserSupported()) return;
            try { await this.revoke(); }
            catch { throw new Error('Availability notifications could not be disabled.'); }
        });
    }
}
