import type {Movie} from '@/domain';

import {
    applyRemotePreferences,
    getDefaultSyncedPreferences,
    getSyncedPreferences,
    parseSyncedPreferences,
    subscribePreferences,
} from '../preferences';
import {createKeyValueStore} from '../storage/create-key-value-store';
import type {KeyValueStore} from '../storage/key-value-store';
import {applyRemoteWatchlist, getWatchlistSnapshot, subscribeWatchlist} from '../watchlist';
import {
    MAX_PREFERENCES_CHARS,
    MAX_WATCHLIST_CHARS,
    fetchSyncDocument,
    writeSyncDocument,
    type SyncDocument,
} from './firestore-rest';
import {watchForeground} from './foreground';
import {getIdToken} from './id-token';
import {
    chooseSyncMode,
    parseWatchlist,
    payloadWithinBudget,
    resolveSection,
    unionWatchlist,
    type SyncMode,
} from './merge';

const STORE_ID = 'sync';
const LINKED_UID_KEY = 'linkedUid';
const WATCHLIST_AT_KEY = 'watchlistUpdatedAt';
const PREFERENCES_AT_KEY = 'preferencesUpdatedAt';

const PUSH_DEBOUNCE_MS = 1500;
const PULL_RETRY_MS = 500;
const PULL_RETRY_MAX_MS = 60000;

let store: KeyValueStore | null = null;
let started = false;
let currentUid: string | null = null;
let mergedUid: string | null = null;
let applying = false;
let running = false;
let pushTimer: ReturnType<typeof setTimeout> | null = null;
let pullTimer: ReturnType<typeof setTimeout> | null = null;
let pullBackoff = PULL_RETRY_MS;
let watchlistDirty = false;
let preferencesDirty = false;
let lastPreferencesPayload: string | null = null;

function getStore(): KeyValueStore {
    if (!store) store = createKeyValueStore(STORE_ID);
    return store;
}

function readVersion(key: string): number {
    const raw = getStore().getString(key);
    const parsed = raw ? Number(raw) : 0;
    return Number.isFinite(parsed) ? parsed : 0;
}

function writeVersion(key: string, value: number): void {
    getStore().set(key, String(value));
}

function applyRemote(action: () => void): void {
    applying = true;
    try {
        action();
    } finally {
        applying = false;
    }
}

function watchlistPayload(): string | null {
    return payloadWithinBudget(getWatchlistSnapshot(), MAX_WATCHLIST_CHARS);
}

function preferencesPayload(): string | null {
    return payloadWithinBudget(getSyncedPreferences(), MAX_PREFERENCES_CHARS);
}

function cancelPush(): void {
    if (!pushTimer) return;
    clearTimeout(pushTimer);
    pushTimer = null;
}

function schedulePush(): void {
    if (!currentUid) return;
    cancelPush();
    pushTimer = setTimeout(() => {
        pushTimer = null;
        void push();
    }, PUSH_DEBOUNCE_MS);
}

function schedulePull(delay: number = PULL_RETRY_MS): void {
    if (pullTimer) return;
    pullTimer = setTimeout(() => {
        pullTimer = null;
        void pull();
    }, delay);
}

function cancelPull(): void {
    if (!pullTimer) return;
    clearTimeout(pullTimer);
    pullTimer = null;
}

function onWatchlistChanged(): void {
    if (applying) return;
    writeVersion(WATCHLIST_AT_KEY, readVersion(WATCHLIST_AT_KEY) + 1);
    watchlistDirty = true;
    schedulePush();
}

function onPreferencesChanged(): void {
    if (applying) return;
    const payload = JSON.stringify(getSyncedPreferences());
    if (payload === lastPreferencesPayload) return;
    lastPreferencesPayload = payload;
    writeVersion(PREFERENCES_AT_KEY, readVersion(PREFERENCES_AT_KEY) + 1);
    preferencesDirty = true;
    schedulePush();
}

async function push(): Promise<void> {
    const uid = currentUid;
    if (!uid || uid !== mergedUid) return;
    if (!watchlistDirty && !preferencesDirty) return;
    if (running) {
        schedulePush();
        return;
    }
    running = true;
    try {
        const token = await getIdToken();
        if (!token || currentUid !== uid) return;
        const patch: SyncDocument = {};
        const watchlist = watchlistDirty ? watchlistPayload() : null;
        const watchlistAt = readVersion(WATCHLIST_AT_KEY);
        if (watchlist != null) {
            patch.watchlist = watchlist;
            patch.watchlistUpdatedAt = watchlistAt;
        }
        const preferences = preferencesDirty ? preferencesPayload() : null;
        const preferencesAt = readVersion(PREFERENCES_AT_KEY);
        if (preferences != null) {
            patch.preferences = preferences;
            patch.preferencesUpdatedAt = preferencesAt;
        }
        if (!(await writeSyncDocument(uid, token, patch))) return;
        if (currentUid !== uid) return;
        if (patch.watchlist !== undefined && readVersion(WATCHLIST_AT_KEY) === watchlistAt) {
            watchlistDirty = false;
        }
        if (patch.preferences !== undefined && readVersion(PREFERENCES_AT_KEY) === preferencesAt) {
            preferencesDirty = false;
        }
    } catch {
    } finally {
        running = false;
    }
}

function mergeWatchlist(remote: SyncDocument, mode: SyncMode): void {
    const remoteItems = parseWatchlist<Movie>(remote.watchlist);
    const remoteAt = remote.watchlistUpdatedAt ?? 0;
    const localAt = readVersion(WATCHLIST_AT_KEY);
    if (mode === 'union') {
        const merged = unionWatchlist(getWatchlistSnapshot(), remoteItems);
        applyRemote(() => applyRemoteWatchlist(merged));
        writeVersion(WATCHLIST_AT_KEY, Math.max(localAt, remoteAt) + 1);
        watchlistDirty = true;
        return;
    }
    const resolution = resolveSection(mode, remoteAt, localAt);
    if (resolution === 'apply-remote') {
        applyRemote(() => applyRemoteWatchlist(remoteItems));
        writeVersion(WATCHLIST_AT_KEY, remoteAt);
        watchlistDirty = false;
        return;
    }
    if (resolution === 'push-local') watchlistDirty = true;
}

function mergePreferences(remote: SyncDocument, mode: SyncMode): void {
    const remotePreferences = remote.preferences ? parseSyncedPreferences(remote.preferences) : null;
    const remoteAt = remote.preferencesUpdatedAt ?? 0;
    const localAt = readVersion(PREFERENCES_AT_KEY);
    if (remotePreferences == null) {
        if (mode === 'remote-wins') {
            applyRemote(() => applyRemotePreferences(getDefaultSyncedPreferences()));
            lastPreferencesPayload = JSON.stringify(getSyncedPreferences());
            writeVersion(PREFERENCES_AT_KEY, remoteAt);
            preferencesDirty = false;
            return;
        }
        preferencesDirty = true;
        return;
    }
    const resolution = resolveSection(mode, remoteAt, localAt);
    if (resolution === 'apply-remote') {
        applyRemote(() => applyRemotePreferences(remotePreferences));
        lastPreferencesPayload = JSON.stringify(getSyncedPreferences());
        writeVersion(PREFERENCES_AT_KEY, remoteAt);
        preferencesDirty = false;
        return;
    }
    if (resolution === 'push-local') preferencesDirty = true;
}

async function pull(): Promise<void> {
    const uid = currentUid;
    if (!uid) return;
    if (running) {
        schedulePull();
        return;
    }
    running = true;
    let merged = false;
    try {
        const token = await getIdToken();
        if (!token || currentUid !== uid) return;
        const remote = await fetchSyncDocument(uid, token);
        if (remote == null || currentUid !== uid) return;
        const mode = chooseSyncMode(getStore().getString(LINKED_UID_KEY), uid);
        mergeWatchlist(remote, mode);
        mergePreferences(remote, mode);
        getStore().set(LINKED_UID_KEY, uid);
        mergedUid = uid;
        merged = true;
        pullBackoff = PULL_RETRY_MS;
    } catch {
    } finally {
        running = false;
    }
    if (currentUid !== uid) return;
    if (merged) {
        await push();
        return;
    }
    schedulePull(pullBackoff);
    pullBackoff = Math.min(pullBackoff * 2, PULL_RETRY_MAX_MS);
}

export function startAccountSync(): void {
    if (started) return;
    started = true;
    lastPreferencesPayload = JSON.stringify(getSyncedPreferences());
    subscribeWatchlist(onWatchlistChanged);
    subscribePreferences(onPreferencesChanged);
    watchForeground(() => {
        void pull();
    });
}

export function setSyncAccount(uid: string | null): void {
    if (uid === currentUid) return;
    cancelPush();
    cancelPull();
    pullBackoff = PULL_RETRY_MS;
    currentUid = uid;
    mergedUid = null;
    if (!uid) return;
    void pull();
}
