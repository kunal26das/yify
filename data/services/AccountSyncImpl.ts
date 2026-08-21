import {
    IDLE_SYNC_STATUS,
    chooseSyncMode,
    encodeWatchlistState,
    fitWatchlistPayload,
    markChanges,
    mergeWatchlistState,
    parseWatchlistState,
    payloadWithinBudget,
    pruneMarks,
    resolveSection,
    sameWatchlistState,
    type AccountSync,
    type AuthRepository,
    type KeyValueStore,
    type Movie,
    type PreferencesRepository,
    type SyncFailure,
    type SyncMode,
    type SyncStatus,
    type WatchlistMarks,
    type WatchlistRepository,
    type WatchlistState,
} from '@/domain';
import {
    MAX_PREFERENCES_CHARS,
    MAX_WATCHLIST_CHARS,
    fetchSyncDocument,
    writeSyncDocument,
    type SyncDocument,
} from '../datasources/sync/FirestoreSyncDataSource';
import {isForeground, watchForeground} from '../datasources/platform/ForegroundWatcher';
import {parseSyncedPreferences} from '../repositories/PreferencesRepositoryImpl';
import {createObservable} from '../repositories/support/observable';

const LINKED_UID_KEY = 'linkedUid';
const MARKS_KEY = 'watchlistMarks';
const PREFERENCES_AT_KEY = 'preferencesUpdatedAt';
const LAST_SYNCED_AT_KEY = 'lastSyncedAt';

const PUSH_DEBOUNCE_MS = 1500;
const RETRY_MS = 1000;
const RETRY_MAX_MS = 60000;
const POLL_MS = 30000;

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
    private readonly status = createObservable<SyncStatus>(IDLE_SYNC_STATUS);

    private started = false;
    private currentUid: string | null = null;
    private mergedUid: string | null = null;
    private applying = false;
    private running = false;
    private pushTimer: ReturnType<typeof setTimeout> | null = null;
    private retryTimer: ReturnType<typeof setTimeout> | null = null;
    private pollTimer: ReturnType<typeof setInterval> | null = null;
    private backoff = RETRY_MS;
    private watchlistDirty = false;
    private preferencesDirty = false;
    private watchlistRevision = 0;
    private preferencesRevision = 0;
    private marks: WatchlistMarks = {};
    private trackedIds: number[] = [];
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
        this.marks = parseWatchlistState<Movie>(this.store.getString(MARKS_KEY)).marks;
        this.trackedIds = this.watchlist.getAll().map((movie) => movie.id);
        this.lastPreferencesPayload = JSON.stringify(this.preferences.getSynced());
        const lastSyncedAt = this.readNumber(LAST_SYNCED_AT_KEY);
        this.status.set({lastSyncedAt: lastSyncedAt || null});
        this.watchlist.subscribe(() => this.onWatchlistChanged());
        this.preferences.subscribe(() => this.onPreferencesChanged());
        watchForeground(() => this.syncNow());
        this.pollTimer = setInterval(() => {
            if (!this.currentUid || !isForeground()) return;
            void this.pull();
        }, POLL_MS);
    }

    setAccount(uid: string | null): void {
        if (uid === this.currentUid) return;
        this.cancelPush();
        this.cancelRetry();
        this.backoff = RETRY_MS;
        this.currentUid = uid;
        this.mergedUid = null;
        if (!uid) {
            this.status.set({state: 'idle', failure: null, detail: null});
            return;
        }
        void this.pull();
    }

    syncNow(): void {
        if (!this.currentUid) return;
        this.cancelRetry();
        this.backoff = RETRY_MS;
        void this.pull();
    }

    getStatus(): SyncStatus {
        return this.status.get();
    }

    subscribe(listener: () => void): () => void {
        return this.status.subscribe(listener);
    }

    private readNumber(key: string): number {
        const raw = this.store.getString(key);
        const parsed = raw ? Number(raw) : 0;
        return Number.isFinite(parsed) ? parsed : 0;
    }

    private localState(): WatchlistState<Movie> {
        return {items: this.watchlist.getAll(), marks: this.marks};
    }

    private persistMarks(): void {
        this.store.set(MARKS_KEY, encodeWatchlistState<Movie>({items: [], marks: this.marks}));
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

    private cancelRetry(): void {
        if (!this.retryTimer) return;
        clearTimeout(this.retryTimer);
        this.retryTimer = null;
    }

    private schedulePush(): void {
        if (!this.currentUid) return;
        this.cancelPush();
        this.pushTimer = setTimeout(() => {
            this.pushTimer = null;
            void this.push();
        }, PUSH_DEBOUNCE_MS);
    }

    private scheduleRetry(): void {
        if (this.retryTimer || !this.currentUid) return;
        const delay = this.backoff;
        this.retryTimer = setTimeout(() => {
            this.retryTimer = null;
            void this.pull();
        }, delay);
        this.backoff = Math.min(this.backoff * 2, RETRY_MAX_MS);
    }

    private fail(failure: SyncFailure, detail: string): void {
        this.status.set({state: 'error', failure, detail});
        this.scheduleRetry();
    }

    private succeed(trimmed: boolean): void {
        const now = Date.now();
        this.store.set(LAST_SYNCED_AT_KEY, String(now));
        this.backoff = RETRY_MS;
        this.status.set({
            state: trimmed ? 'error' : 'synced',
            failure: trimmed ? 'oversized' : null,
            detail: trimmed ? 'watchlist too large to sync in full' : null,
            lastSyncedAt: now,
            pendingChanges: this.watchlistDirty || this.preferencesDirty,
        });
    }

    private onWatchlistChanged(): void {
        const nextIds = this.watchlist.getAll().map((movie) => movie.id);
        if (this.applying) {
            this.trackedIds = nextIds;
            return;
        }
        this.marks = markChanges(this.marks, this.trackedIds, nextIds, Date.now());
        this.trackedIds = nextIds;
        this.persistMarks();
        this.watchlistDirty = true;
        this.watchlistRevision += 1;
        this.status.set({pendingChanges: true});
        this.schedulePush();
    }

    private onPreferencesChanged(): void {
        if (this.applying) return;
        const payload = JSON.stringify(this.preferences.getSynced());
        if (payload === this.lastPreferencesPayload) return;
        this.lastPreferencesPayload = payload;
        this.store.set(PREFERENCES_AT_KEY, String(Date.now()));
        this.preferencesDirty = true;
        this.preferencesRevision += 1;
        this.status.set({pendingChanges: true});
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
        this.status.set({state: 'syncing'});
        try {
            const token = await this.auth.getIdToken();
            if (this.currentUid !== uid) return;
            if (!token) {
                this.fail('denied', 'no id token available');
                return;
            }
            const watchlistRevision = this.watchlistRevision;
            const preferencesRevision = this.preferencesRevision;
            const patch: SyncDocument = {};
            let trimmed = false;
            if (this.watchlistDirty) {
                const fitted = fitWatchlistPayload(this.localState(), MAX_WATCHLIST_CHARS);
                patch.watchlist = fitted.payload;
                patch.watchlistUpdatedAt = Date.now();
                trimmed = fitted.trimmed;
            }
            if (this.preferencesDirty) {
                const preferences = payloadWithinBudget(
                    this.preferences.getSynced(),
                    MAX_PREFERENCES_CHARS
                );
                if (preferences == null) {
                    this.fail('oversized', 'preferences exceed the sync budget');
                    return;
                }
                patch.preferences = preferences;
                patch.preferencesUpdatedAt = this.readNumber(PREFERENCES_AT_KEY);
            }
            const result = await writeSyncDocument(uid, token, patch);
            if (this.currentUid !== uid) return;
            if (!result.ok) {
                this.fail(result.failure, result.detail);
                return;
            }
            if (patch.watchlist !== undefined && this.watchlistRevision === watchlistRevision) {
                this.watchlistDirty = false;
            }
            if (
                patch.preferences !== undefined &&
                this.preferencesRevision === preferencesRevision
            ) {
                this.preferencesDirty = false;
            }
            this.succeed(trimmed);
            if (this.watchlistDirty || this.preferencesDirty) this.schedulePush();
        } finally {
            this.running = false;
        }
    }

    private mergeWatchlist(remote: SyncDocument, mode: SyncMode): void {
        const remoteState = parseWatchlistState<Movie>(remote.watchlist);
        if (mode === 'remote-wins') {
            this.marks = remoteState.marks;
            this.persistMarks();
            this.applyRemote(() => this.watchlist.applyRemote(remoteState.items));
            this.trackedIds = remoteState.items.map((movie) => movie.id);
            this.watchlistDirty = false;
            return;
        }
        const merged = mergeWatchlistState<Movie>(this.localState(), remoteState);
        const next: WatchlistState<Movie> = {
            items: merged.items,
            marks: pruneMarks(merged.marks, Date.now()),
        };
        this.marks = next.marks;
        this.persistMarks();
        this.applyRemote(() => this.watchlist.applyRemote(next.items));
        this.trackedIds = next.items.map((movie) => movie.id);
        if (!sameWatchlistState(next, remoteState)) {
            this.watchlistDirty = true;
            this.watchlistRevision += 1;
        }
    }

    private mergePreferences(remote: SyncDocument, mode: SyncMode): void {
        const remotePreferences = remote.preferences
            ? parseSyncedPreferences(remote.preferences)
            : null;
        const remoteAt = remote.preferencesUpdatedAt ?? 0;
        const localAt = this.readNumber(PREFERENCES_AT_KEY);
        if (remotePreferences == null) {
            if (mode === 'remote-wins') {
                this.applyRemote(() =>
                    this.preferences.applyRemote(this.preferences.getDefaultSynced())
                );
                this.lastPreferencesPayload = JSON.stringify(this.preferences.getSynced());
                this.store.set(PREFERENCES_AT_KEY, String(remoteAt));
                this.preferencesDirty = false;
                return;
            }
            this.preferencesDirty = true;
            this.preferencesRevision += 1;
            return;
        }
        const resolution = resolveSection(mode, remoteAt, localAt);
        if (resolution === 'apply-remote') {
            this.applyRemote(() => {
                if (mode === 'remote-wins') {
                    this.preferences.applyRemote(this.preferences.getDefaultSynced());
                }
                this.preferences.applyRemote(remotePreferences);
            });
            this.lastPreferencesPayload = JSON.stringify(this.preferences.getSynced());
            this.store.set(PREFERENCES_AT_KEY, String(remoteAt));
            this.preferencesDirty = false;
            return;
        }
        if (resolution === 'push-local') {
            this.preferencesDirty = true;
            this.preferencesRevision += 1;
        }
    }

    private async pull(): Promise<void> {
        const uid = this.currentUid;
        if (!uid) return;
        if (this.running) {
            this.scheduleRetry();
            return;
        }
        this.running = true;
        this.status.set({state: 'syncing'});
        let merged = false;
        try {
            const token = await this.auth.getIdToken();
            if (this.currentUid !== uid) return;
            if (!token) {
                this.fail('denied', 'no id token available');
                return;
            }
            const result = await fetchSyncDocument(uid, token);
            if (this.currentUid !== uid) return;
            if (!result.ok) {
                this.fail(result.failure, result.detail);
                return;
            }
            const mode = chooseSyncMode(this.store.getString(LINKED_UID_KEY), uid);
            this.mergeWatchlist(result.document, mode);
            this.mergePreferences(result.document, mode);
            this.store.set(LINKED_UID_KEY, uid);
            this.mergedUid = uid;
            this.backoff = RETRY_MS;
            merged = true;
        } finally {
            this.running = false;
        }
        if (!merged || this.currentUid !== uid) return;
        if (this.watchlistDirty || this.preferencesDirty) {
            await this.push();
            return;
        }
        this.succeed(false);
    }
}
