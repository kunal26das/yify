'use strict';

const APP_ROOT = new URL('./', self.location.href);
const EVENT_PREFIX = 'yify-availability:';
let pending = Promise.resolve();

function target(path, eventId) {
    if (typeof path !== 'string' || !/^\/(?:watchlist|movie\/[1-9]\d{0,14})$/.test(path)
        || typeof eventId !== 'string' || !/^[A-Za-z\d_:.-]{1,128}$/.test(eventId)) return null;
    const url = new URL(path.slice(1), APP_ROOT);
    if (url.origin !== self.location.origin) return null;
    url.searchParams.set('notification_kind', 'availability');
    url.searchParams.set('notification_event', eventId);
    return url.href;
}

function content(payload) {
    const value = payload?.data;
    if (!value || value.kind !== 'availability'
        || typeof value.eventId !== 'string' || !/^[A-Za-z\d_:.-]{1,128}$/.test(value.eventId)
        || typeof value.title !== 'string' || !value.title.trim() || value.title.length > 160
        || typeof value.body !== 'string' || !value.body.trim() || value.body.length > 600
        || !target(value.path, value.eventId)) return null;
    return {kind: 'availability', eventId: value.eventId, title: value.title, body: value.body, path: value.path};
}

function updateLedger(eventId, remove = false) {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open('yify-availability-delivery', 1);
        request.onupgradeneeded = () => request.result.createObjectStore('events');
        request.onerror = () => reject(new Error('Notification state is unavailable.'));
        request.onsuccess = () => {
            const database = request.result;
            const transaction = database.transaction('events', 'readwrite');
            const store = transaction.objectStore('events');
            let accepted = false;
            transaction.oncomplete = () => { database.close(); resolve(accepted); };
            transaction.onerror = transaction.onabort = () => { database.close(); reject(new Error('Notification state could not be saved.')); };
            const read = store.get('recent');
            read.onsuccess = () => {
                const now = Date.now();
                const values = (Array.isArray(read.result) ? read.result : []).filter(item => item
                    && typeof item.id === 'string' && Number.isFinite(item.at) && item.at > now - 7 * 86_400_000);
                accepted = !values.some(item => item.id === eventId);
                const next = values.filter(item => item.id !== eventId);
                if (!remove) next.push({id: eventId, at: now});
                store.put(next.slice(-128), 'recent');
            };
        };
    });
}

async function deliver(payload) {
    const value = content(payload);
    if (!value) return;
    const tag = EVENT_PREFIX + value.eventId;
    if ((await self.registration.getNotifications({tag})).length) return;
    if (!await updateLedger(value.eventId)) return;
    try {
        await self.registration.showNotification(value.title, {
            body: value.body, tag, renotify: false, silent: true,
            data: {kind: value.kind, eventId: value.eventId, path: value.path},
        });
    } catch (error) {
        await updateLedger(value.eventId, true);
        throw error;
    }
}

self.addEventListener('push', event => {
    let payload;
    try { payload = event.data?.json(); } catch { return; }
    pending = pending.catch(() => {}).then(() => deliver(payload));
    event.waitUntil(pending);
});

self.addEventListener('notificationclick', event => {
    const data = event.notification?.data;
    if (data?.kind !== 'availability' || event.notification.tag !== EVENT_PREFIX + data.eventId) return;
    event.notification.close();
    const url = target(data.path, data.eventId);
    if (!url) return;
    event.waitUntil((async () => {
        const windows = await self.clients.matchAll({type: 'window', includeUncontrolled: true});
        for (const client of windows) {
            let current;
            try { current = new URL(client.url); } catch { continue; }
            if (current.origin !== APP_ROOT.origin || !current.pathname.startsWith(APP_ROOT.pathname)) continue;
            try {
                const navigated = await client.navigate(url);
                if (navigated) { await navigated.focus(); return; }
            } catch {}
        }
        await self.clients.openWindow(url);
    })());
});
