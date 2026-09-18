import type {AuthRepository} from '@/domain/repositories/AuthRepository';
import type {KeyValueStore} from '@/domain/repositories/KeyValueStore';
import type {JournalRepository} from '@/domain/repositories/JournalRepository';
import type {NetworkMonitor} from '@/domain/services/NetworkMonitor';
import type {JournalData, JournalEntry, JournalInput, JournalSnapshot} from '@/domain/entities/Journal';
import {emptyJournalData, encodeJournalData, journalEntries, journalLatestTimestamp, JOURNAL_MAX_ENTRIES,
    mergeJournalData, parseJournalData, validateJournalInput} from '@/domain/policies/journal';
import {isForeground, watchForeground} from '../datasources/platform/ForegroundWatcher';
import {JournalConflict, JournalDataSource} from '../datasources/sync/JournalDataSource';

interface JournalOptions {
    auth: AuthRepository;
    store: KeyValueStore;
    network?: NetworkMonitor;
    now?: () => number;
    fetch?: typeof fetch;
}
const EMPTY: JournalSnapshot = {ready: false, entries: [], syncing: false, error: null};
const LOCAL_ERROR = 'Your journal could not be saved on this device. Free up storage and try again.';
const SYNC_ERROR = 'Your journal is saved on this device. Sync will retry when you are connected.';
const DELETED_ERROR = 'This journal was removed by an account deletion request.';

export class JournalRepositoryImpl implements JournalRepository {
    private readonly now: () => number;
    private readonly source: JournalDataSource;
    private snapshot: JournalSnapshot = EMPTY;
    private data = emptyJournalData();
    private uid: string | null = null;
    private revision = 0;
    private paused = false;
    private started = false;
    private hydrated = false;
    private deleted = false;
    private running: Promise<void> | null = null;
    private requested = false;
    private timer: ReturnType<typeof setTimeout> | null = null;
    private backoff = 1000;
    private readonly listeners = new Set<() => void>();

    constructor(private readonly options: JournalOptions) {
        this.now = options.now ?? Date.now;
        this.source = new JournalDataSource(options.fetch);
    }

    start(): void {
        if (this.started) return;
        this.started = true;
        this.options.auth.subscribe(() => this.selectAccount());
        this.options.network?.subscribe(() => { if (this.options.network?.isOnline()) this.retrySync(); });
        watchForeground(() => this.retrySync());
        const timer = setInterval(() => { if (isForeground()) this.retrySync(); }, 300000);
        (timer as unknown as {unref?: () => void}).unref?.();
        this.selectAccount();
    }

    getSnapshot(): JournalSnapshot { return this.snapshot; }
    subscribe(listener: () => void): () => void { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; }

    save(input: JournalInput): string {
        this.assertWritable();
        const value = validateJournalInput(input, this.now());
        const latest = this.latestLocal();
        const previous = value.id ? latest.entries[value.id] : undefined;
        if (value.id && (!previous || previous.deletedAt)) throw new Error('This journal entry was removed.');
        if (!value.id && Object.keys(latest.entries).length >= JOURNAL_MAX_ENTRIES) throw new Error('Your journal has reached its storage limit.');
        const at = this.nextTimestamp(latest);
        const baseId = `j_${at.toString(36)}_${Math.random().toString(36).slice(2, 14)}`;
        let id = value.id ?? baseId;
        let collision = 0;
        while (!value.id && Object.hasOwn(latest.entries, id)) id = `${baseId}_${++collision}`;
        const entry: JournalEntry = {id, movie: value.movie, watchedOn: value.watchedOn, rating: value.rating,
            note: value.note, updatedAt: at, deletedAt: 0};
        this.commitLocal({...latest, entries: {...latest.entries, [id]: entry}});
        this.schedule(1000);
        return id;
    }

    remove(id: string): void {
        this.assertWritable();
        const latest = this.latestLocal();
        const entry = Object.hasOwn(latest.entries, id) ? latest.entries[id] : undefined;
        if (!entry || entry.deletedAt) return;
        const at = this.nextTimestamp(latest);
        // Preserve only a revision tombstone, not the user's removed note or rating.
        const tombstone: JournalEntry = {id, movie: {id: entry.movie.id, title: 'Removed entry', year: 0,
            runtimeMinutes: 0, genres: [], posterUrl: null}, watchedOn: '1900-01-01', note: '', rating: null,
            updatedAt: at, deletedAt: at};
        this.commitLocal({...latest, entries: {...latest.entries, [id]: tombstone}});
        this.schedule(1000);
    }

    retrySync(): void {
        if (this.paused) return;
        if (this.uid !== this.accountUid()) this.selectAccount();
        if (!this.uid) return;
        if (!this.hydrated && !this.hydrate()) return;
        this.backoff = 1000;
        this.cancelTimer();
        this.runSync();
    }

    async pause(): Promise<void> {
        this.paused = true;
        this.requested = false;
        this.cancelTimer();
        await this.running;
    }

    resume(): void { this.paused = false; this.retrySync(); }

    async deleteRemote(): Promise<boolean> {
        const uid = this.uid;
        await this.pause();
        if (!uid) return true;
        const revision = this.revision;
        try {
            const token = await this.options.auth.getIdToken();
            if (!token || !this.current(uid, revision)) return false;
            await this.source.remove(uid, token, this.now(), () => this.current(uid, revision));
            if (!this.current(uid, revision)) return false;
            this.markDeleted(uid);
            return true;
        } catch {
            if (this.current(uid, revision)) this.publish({error: 'Your journal could not be deleted. Reconnect and try again.'});
            return false;
        }
    }

    private accountUid(): string | null {
        const session = this.options.auth.getSession();
        return session.ready ? session.account?.uid ?? null : null;
    }

    private selectAccount(): void {
        const uid = this.accountUid();
        if (uid === this.uid && this.hydrated) return;
        this.uid = uid;
        this.revision += 1;
        this.cancelTimer();
        this.requested = false;
        this.data = emptyJournalData();
        this.hydrated = false;
        this.deleted = false;
        // Notify subscribers before any read, so previous-account private notes disappear immediately.
        this.publish({ready: false, entries: [], syncing: false, error: null});
        if (!uid) {
            this.hydrated = true;
            this.publish({ready: this.options.auth.getSession().ready});
            return;
        }
        if (this.hydrate() && !this.paused) this.runSync();
    }

    private hydrate(): boolean {
        if (!this.uid) return false;
        try {
            if (this.options.store.getString(this.deletedKey(this.uid)) === 'true') {
                this.markDeleted(this.uid);
                return true;
            }
            this.data = parseJournalData(this.options.store.getString(this.key(this.uid)));
            this.hydrated = true;
            this.publish({ready: true, entries: journalEntries(this.data), error: null});
            return true;
        } catch {
            this.publish({ready: false, entries: [], error: 'Your journal could not be loaded on this device. Retry before adding entries.'});
            return false;
        }
    }

    private assertWritable(): void {
        if (!this.uid || this.uid !== this.accountUid()) throw new Error('Sign in to save your journal.');
        if (this.deleted) throw new Error(DELETED_ERROR);
        if (this.paused || !this.hydrated) throw new Error('Wait for your journal to finish loading, then try again.');
    }

    private nextTimestamp(data: JournalData): number {
        const at = Math.max(Math.trunc(this.now()), journalLatestTimestamp(data) + 1);
        if (!Number.isSafeInteger(at) || at <= 0) throw new Error('Your journal could not be updated.');
        return at;
    }

    private commitLocal(data: JournalData): void {
        const merged = mergeJournalData(data, this.latestLocal());
        const encoded = encodeJournalData(merged);
        try { this.options.store.set(this.key(this.uid!), encoded); }
        catch { this.publish({error: LOCAL_ERROR}); throw new Error(LOCAL_ERROR); }
        this.data = merged;
        this.publish({entries: journalEntries(merged), error: null});
    }

    private latestLocal(): JournalData {
        try { return mergeJournalData(this.data, parseJournalData(this.options.store.getString(this.key(this.uid!)))); }
        catch { this.publish({error: LOCAL_ERROR}); throw new Error(LOCAL_ERROR); }
    }

    private runSync(): void {
        if (!this.uid || !this.hydrated || this.paused || this.deleted) return;
        if (this.options.network && !this.options.network.isOnline()) { this.publish({syncing: false, error: SYNC_ERROR}); return; }
        if (this.running) { this.requested = true; return; }
        const uid = this.uid;
        const revision = this.revision;
        this.requested = false;
        this.publish({syncing: true});
        this.running = this.sync(uid, revision).finally(() => {
            this.running = null;
            if (this.current(uid, revision)) this.publish({syncing: false});
            if (this.requested && !this.paused) { this.requested = false; this.schedule(0); }
        });
    }

    private async sync(uid: string, revision: number): Promise<void> {
        try {
            const cached = this.latestLocal();
            if (encodeJournalData(cached) !== encodeJournalData(this.data)) this.commitLocal(cached);
            const token = await this.options.auth.getIdToken();
            if (!this.active(uid, revision)) return;
            if (!token) throw new Error('Authentication unavailable');
            for (let attempt = 0; attempt < 3; attempt += 1) {
                const remote = await this.source.read(uid, token);
                if (!this.active(uid, revision)) return;
                if (remote.deleting) {
                    this.markDeleted(uid);
                    return;
                }
                const merged = mergeJournalData(this.data, remote.data);
                const encoded = encodeJournalData(merged);
                if (encodeJournalData(this.data) !== encoded) this.commitLocal(merged);
                if (encodeJournalData(remote.data) === encoded) { this.publish({error: null}); this.backoff = 1000; return; }
                try { await this.source.write(uid, token, merged, remote.updateTime, this.now()); }
                catch (error) { if (error instanceof JournalConflict && attempt < 2) continue; throw error; }
                if (!this.active(uid, revision)) return;
                if (encoded !== encodeJournalData(this.data)) this.requested = true;
                this.publish({error: null});
                this.backoff = 1000;
                return;
            }
        } catch {
            if (!this.active(uid, revision)) return;
            this.publish({error: this.deleted ? DELETED_ERROR : this.snapshot.error === LOCAL_ERROR ? LOCAL_ERROR : SYNC_ERROR});
            this.schedule(this.backoff);
            this.backoff = Math.min(60000, this.backoff * 2);
        }
    }

    private key(uid: string): string { return `account:${uid}`; }
    private deletedKey(uid: string): string { return `deleted:${uid}`; }
    private markDeleted(uid: string): void {
        this.deleted = true;
        this.hydrated = true;
        this.data = emptyJournalData();
        this.publish({ready: false, entries: [], syncing: false, error: DELETED_ERROR});
        this.options.store.set(this.deletedKey(uid), 'true');
        this.options.store.delete(this.key(uid));
    }
    private current(uid: string, revision: number): boolean { return this.uid === uid && this.revision === revision && this.accountUid() === uid; }
    private active(uid: string, revision: number): boolean { return !this.paused && this.current(uid, revision); }
    private schedule(delay: number): void {
        if (this.paused || !this.uid) return;
        this.cancelTimer();
        this.timer = setTimeout(() => { this.timer = null; this.runSync(); }, delay);
        (this.timer as unknown as {unref?: () => void}).unref?.();
    }
    private cancelTimer(): void { if (this.timer !== null) clearTimeout(this.timer); this.timer = null; }
    private publish(patch: Partial<JournalSnapshot>): void {
        this.snapshot = {...this.snapshot, ...patch};
        this.listeners.forEach(listener => listener());
    }
}
