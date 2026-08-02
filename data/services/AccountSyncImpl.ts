import {
    chooseSyncMode,
    parseWatchlist,
    payloadWithinBudget,
    resolveSection,
    unionWatchlist,
    type AccountSync,
    type AuthRepository,
    type KeyValueStore,
    type Movie,
    type PreferencesRepository,
    type SyncMode,
    type WatchlistRepository,
} from '@/domain';
import {
    MAX_PREFERENCES_CHARS,
    MAX_WATCHLIST_CHARS,
    fetchSyncDocument,
    writeSyncDocument,
    type SyncDocument,
} from '../datasources/sync/FirestoreSyncDataSource';
import {watchForeground} from '../datasources/platform/ForegroundWatcher';
import {parseSyncedPreferences} from '../repositories/PreferencesRepositoryImpl';

const LINKED_UID_KEY = 'linkedUid';
const WATCHLIST_AT_KEY = 'watchlistUpdatedAt';
const PREFERENCES_AT_KEY = 'preferencesUpdatedAt';

const PUSH_DEBOUNCE_MS = 1500;
const PULL_RETRY_MS = 500;
const PULL_RETRY_MAX_MS = 60000;

interface AccountSyncDeps {
    store: KeyValueStore;
    auth: AuthRepository;
    watchlist: WatchlistRepository;
    preferences: PreferencesRepository;
}

export class AccountSyncImpl implements AccountSync {
    private readonly store: KeyValueStore;
    private readonly auth: AuthRepository;
    private readonly watchlist: WatchlistRepository;
    private readonly preferences: PreferencesRepository;

    private started = false;
    private currentUid: string | null = null;
    private mergedUid: string | null = null;
    private applying = false;
    private running = false;
    private pushTimer: ReturnType<typeof setTimeout> | null = null;
    private pullTimer: ReturnType<typeof setTimeout> | null = null;
    private pullBackoff = PULL_RETRY_MS;
    private watchlistDirty = false;
    private preferencesDirty = false;
    private lastPreferencesPayload: string | null = null;

    constructor({store, auth, watchlist, preferences}: AccountSyncDeps) {
        this.store = store;
        this.auth = auth;
        this.watchlist = watchlist;
        this.preferences = preferences;
    }

    start(): void {
        if (this.started) return;
        this.started = true;
        this.lastPreferencesPayload = JSON.stringify(this.preferences.getSynced());
        this.watchlist.subscribe(() => this.onWatchlistChanged());
        this.preferences.subscribe(() => this.onPreferencesChanged());
        watchForeground(() => {
            void this.pull();
        });
    }

    setAccount(uid: string | null): void {
        if (uid === this.currentUid) return;
        this.cancelPush();
        this.cancelPull();
        this.pullBackoff = PULL_RETRY_MS;
        this.currentUid = uid;
        this.mergedUid = null;
        if (!uid) return;
        void this.pull();
    }

    private readVersion(key: string): number {
        const raw = this.store.getString(key);
        const parsed = raw ? Number(raw) : 0;
        return Number.isFinite(parsed) ? parsed : 0;
    }

    private writeVersion(key: string, value: number): void {
        this.store.set(key, String(value));
    }

    private applyRemote(action: () => void): void {
        this.applying = true;
        try {
            action();
        } finally {
            this.applying = false;
        }
    }

    private cancelPush(): void {
        if (!this.pushTimer) return;
        clearTimeout(this.pushTimer);
        this.pushTimer = null;
    }

    private schedulePush(): void {
        if (!this.currentUid) return;
        this.cancelPush();
        this.pushTimer = setTimeout(() => {
            this.pushTimer = null;
            void this.push();
        }, PUSH_DEBOUNCE_MS);
    }

    private schedulePull(delay: number = PULL_RETRY_MS): void {
        if (this.pullTimer) return;
        this.pullTimer = setTimeout(() => {
            this.pullTimer = null;
            void this.pull();
        }, delay);
    }

    private cancelPull(): void {
        if (!this.pullTimer) return;
        clearTimeout(this.pullTimer);
        this.pullTimer = null;
    }

    private onWatchlistChanged(): void {
        if (this.applying) return;
        this.writeVersion(WATCHLIST_AT_KEY, this.readVersion(WATCHLIST_AT_KEY) + 1);
        this.watchlistDirty = true;
        this.schedulePush();
    }

    private onPreferencesChanged(): void {
        if (this.applying) return;
        const payload = JSON.stringify(this.preferences.getSynced());
        if (payload === this.lastPreferencesPayload) return;
        this.lastPreferencesPayload = payload;
        this.writeVersion(PREFERENCES_AT_KEY, this.readVersion(PREFERENCES_AT_KEY) + 1);
        this.preferencesDirty = true;
        this.schedulePush();
    }

    private async push(): Promise<void> {
        const uid = this.currentUid;
        if (!uid || uid !== this.mergedUid) return;
        if (!this.watchlistDirty && !this.preferencesDirty) return;
        if (this.running) {
            this.schedulePush();
            return;
        }
        this.running = true;
        try {
            const token = await this.auth.getIdToken();
            if (!token || this.currentUid !== uid) return;
            const patch: SyncDocument = {};
            const watchlist = this.watchlistDirty
                ? payloadWithinBudget(this.watchlist.getAll(), MAX_WATCHLIST_CHARS)
                : null;
            const watchlistAt = this.readVersion(WATCHLIST_AT_KEY);
            if (watchlist != null) {
                patch.watchlist = watchlist;
                patch.watchlistUpdatedAt = watchlistAt;
            }
            const preferences = this.preferencesDirty
                ? payloadWithinBudget(this.preferences.getSynced(), MAX_PREFERENCES_CHARS)
                : null;
            const preferencesAt = this.readVersion(PREFERENCES_AT_KEY);
            if (preferences != null) {
                patch.preferences = preferences;
                patch.preferencesUpdatedAt = preferencesAt;
            }
            if (!(await writeSyncDocument(uid, token, patch))) return;
            if (this.currentUid !== uid) return;
            if (
                patch.watchlist !== undefined &&
                this.readVersion(WATCHLIST_AT_KEY) === watchlistAt
            ) {
                this.watchlistDirty = false;
            }
            if (
                patch.preferences !== undefined &&
                this.readVersion(PREFERENCES_AT_KEY) === preferencesAt
            ) {
                this.preferencesDirty = false;
            }
        } catch {
        } finally {
            this.running = false;
        }
    }

    private mergeWatchlist(remote: SyncDocument, mode: SyncMode): void {
        const remoteItems = parseWatchlist<Movie>(remote.watchlist);
        const remoteAt = remote.watchlistUpdatedAt ?? 0;
        const localAt = this.readVersion(WATCHLIST_AT_KEY);
        if (mode === 'union') {
            const merged = unionWatchlist(this.watchlist.getAll(), remoteItems);
            this.applyRemote(() => this.watchlist.applyRemote(merged));
            this.writeVersion(WATCHLIST_AT_KEY, Math.max(localAt, remoteAt) + 1);
            this.watchlistDirty = true;
            return;
        }
        const resolution = resolveSection(mode, remoteAt, localAt);
        if (resolution === 'apply-remote') {
            this.applyRemote(() => this.watchlist.applyRemote(remoteItems));
            this.writeVersion(WATCHLIST_AT_KEY, remoteAt);
            this.watchlistDirty = false;
            return;
        }
        if (resolution === 'push-local') this.watchlistDirty = true;
    }

    private mergePreferences(remote: SyncDocument, mode: SyncMode): void {
        const remotePreferences = remote.preferences
            ? parseSyncedPreferences(remote.preferences)
            : null;
        const remoteAt = remote.preferencesUpdatedAt ?? 0;
        const localAt = this.readVersion(PREFERENCES_AT_KEY);
        if (remotePreferences == null) {
            if (mode === 'remote-wins') {
                this.applyRemote(() =>
                    this.preferences.applyRemote(this.preferences.getDefaultSynced())
                );
                this.lastPreferencesPayload = JSON.stringify(this.preferences.getSynced());
                this.writeVersion(PREFERENCES_AT_KEY, remoteAt);
                this.preferencesDirty = false;
                return;
            }
            this.preferencesDirty = true;
            return;
        }
        const resolution = resolveSection(mode, remoteAt, localAt);
        if (resolution === 'apply-remote') {
            this.applyRemote(() => this.preferences.applyRemote(remotePreferences));
            this.lastPreferencesPayload = JSON.stringify(this.preferences.getSynced());
            this.writeVersion(PREFERENCES_AT_KEY, remoteAt);
            this.preferencesDirty = false;
            return;
        }
        if (resolution === 'push-local') this.preferencesDirty = true;
    }

    private async pull(): Promise<void> {
        const uid = this.currentUid;
        if (!uid) return;
        if (this.running) {
            this.schedulePull();
            return;
        }
        this.running = true;
        let merged = false;
        try {
            const token = await this.auth.getIdToken();
            if (!token || this.currentUid !== uid) return;
            const remote = await fetchSyncDocument(uid, token);
            if (remote == null || this.currentUid !== uid) return;
            const mode = chooseSyncMode(this.store.getString(LINKED_UID_KEY), uid);
            this.mergeWatchlist(remote, mode);
            this.mergePreferences(remote, mode);
            this.store.set(LINKED_UID_KEY, uid);
            this.mergedUid = uid;
            merged = true;
            this.pullBackoff = PULL_RETRY_MS;
        } catch {
        } finally {
            this.running = false;
        }
        if (this.currentUid !== uid) return;
        if (merged) {
            await this.push();
            return;
        }
        this.schedulePull(this.pullBackoff);
        this.pullBackoff = Math.min(this.pullBackoff * 2, PULL_RETRY_MAX_MS);
    }
}
