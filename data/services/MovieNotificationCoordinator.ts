import type {KeyValueStore, Movie, NewMoviesNotification, NotificationPreferences, Preferences, Quality} from '@/domain';
import {
    DEFAULT_NOTIFICATION_PREFERENCES,
    NOTIFICATION_BURST_LIMIT,
    buildDailyMoviePicks,
    buildNotificationBatch,
    filterNotifiableMovies,
    localNotificationDateKey,
    notificationQuerySignature,
    quietHoursEndAt,
    selectNewMovies,
} from '@/domain';
import {SeenMoviesRepositoryImpl} from '../repositories/SeenMoviesRepositoryImpl';

export interface ScheduledMovieNotification {
    identifier: string;
    content: NewMoviesNotification;
    date: Date | null;
}

export interface NotificationDelivery {
    hasPermission(): Promise<boolean>;
    pending(): Promise<string[]>;
    schedule(item: ScheduledMovieNotification): Promise<void>;
    cancel(id: string): Promise<void>;
}

interface CoordinatorOptions {
    store: KeyValueStore;
    delivery: NotificationDelivery;
    preferences: () => Preferences;
    fetchMovies: (quality: Quality) => Promise<Movie[]>;
    watchlist: () => Movie[];
    watched: () => {isWatched(id: number): boolean};
    now?: () => Date;
}

interface Snapshot {
    revision: number;
    key: string;
    enabled: boolean;
    notify: NotificationPreferences;
}

interface DailyLedgerEntry {
    identifier: string;
    movieId: number;
    date: number;
    content: NewMoviesNotification;
    saved: boolean;
}

interface RecentPick {
    movieId: number;
    date: number;
}

interface Catalog {
    fetchedAt: number;
    movies: Movie[];
}

const DAILY_PREFIX = 'yify-daily-pick:';
const DAILY_LEDGER_KEY = 'daily-pick-ledger';
const DAILY_HISTORY_KEY = 'daily-pick-history';
const LAST_ACTIVE_KEY = 'daily-last-active-date';
const LAST_RUN_KEY = 'last-run-date';
const CATALOG_PREFIX = 'notification-catalog:';
const CACHE_MS = 6 * 60 * 60 * 1000;
const HISTORY_MS = 30 * 24 * 60 * 60 * 1000;
const MAX_CATALOG_MOVIES = 200;
const MAX_HISTORY = 300;
const MAX_SEEN = 2000;

function preferenceKey(preferences: Preferences): string {
    return JSON.stringify([preferences.notifications, preferences.notify]);
}

function readJSON(store: KeyValueStore, key: string): unknown {
    try {
        const raw = store.getString(key);
        return raw ? JSON.parse(raw) : undefined;
    } catch {
        return undefined;
    }
}

function catalogMovies(value: unknown): Movie[] {
    if (!Array.isArray(value)) return [];
    const seen = new Set<number>();
    return value.slice(0, MAX_CATALOG_MOVIES).filter((movie): movie is Movie => {
        if (!movie || !Number.isSafeInteger(movie.id) || movie.id <= 0 || typeof movie.title !== 'string' ||
            !Array.isArray(movie.genres) || movie.genres.some((genre: unknown) => typeof genre !== 'string') || seen.has(movie.id)) return false;
        seen.add(movie.id);
        return true;
    });
}

function samePick(a: DailyLedgerEntry | undefined, b: DailyLedgerEntry): boolean {
    return !!a && a.date === b.date && a.movieId === b.movieId && JSON.stringify(a.content) === JSON.stringify(b.content);
}

function batchIdentifier(quality: Quality, ids: number[]): string {
    const value = JSON.stringify([quality, [...ids].sort((a, b) => a - b)]);
    let hash = 2166136261;
    for (let i = 0; i < value.length; i++) hash = Math.imul(hash ^ value.charCodeAt(i), 16777619);
    return `yify-new-movies:${(hash >>> 0).toString(16)}`;
}

export class MovieNotificationCoordinator {
    private revision = 0;
    private queue: Promise<unknown> = Promise.resolve();
    private readonly seen: SeenMoviesRepositoryImpl;

    constructor(private readonly options: CoordinatorOptions) {
        this.seen = new SeenMoviesRepositoryImpl(options.store);
    }

    invalidate(): void {
        this.revision++;
    }

    check(force = false): Promise<number> {
        return this.enqueue(() => this.run(force, force));
    }

    refresh(active = false): Promise<number> {
        const now = this.now();
        const today = localNotificationDateKey(now);
        if (active) {
            this.recent(now);
            this.options.store.set(LAST_ACTIVE_KEY, today);
        }
        this.invalidate();
        const cancellation = !this.options.preferences().notifications
            ? this.cancelAll()
            : active ? this.cancel(DAILY_PREFIX + today) : null;
        const settled = cancellation?.then(() => null, (error: unknown) => ({error}));
        return this.enqueue(async () => {
            const failure = await settled;
            if (failure) throw failure.error;
            return this.run(true, false);
        });
    }

    private enqueue(work: () => Promise<number>): Promise<number> {
        const next = this.queue.then(work, work);
        this.queue = next.catch(() => undefined);
        return next;
    }

    private now(): Date {
        return new Date((this.options.now?.() ?? new Date()).getTime());
    }

    private snapshot(): Snapshot {
        const preferences = this.options.preferences();
        return {
            revision: this.revision,
            key: preferenceKey(preferences),
            enabled: preferences.notifications,
            notify: {...preferences.notify},
        };
    }

    private current(snapshot: Snapshot): boolean {
        return snapshot.revision === this.revision && snapshot.key === preferenceKey(this.options.preferences());
    }

    private async changed(snapshot: Snapshot): Promise<boolean> {
        if (this.current(snapshot)) return false;
        if (!this.options.preferences().notifications) await this.cancelAll();
        return true;
    }

    private ledger(): DailyLedgerEntry[] {
        const raw = readJSON(this.options.store, DAILY_LEDGER_KEY);
        if (!Array.isArray(raw)) return [];
        return raw.slice(0, 32).filter((entry): entry is DailyLedgerEntry => entry &&
            typeof entry.identifier === 'string' && entry.identifier.startsWith(DAILY_PREFIX) &&
            Number.isSafeInteger(entry.movieId) && entry.movieId > 0 && Number.isFinite(entry.date) &&
            entry.content && typeof entry.content.title === 'string' && typeof entry.content.body === 'string' &&
            entry.content.data && typeof entry.content.data === 'object');
    }

    private writeLedger(entries: DailyLedgerEntry[]): void {
        this.options.store.set(DAILY_LEDGER_KEY, JSON.stringify(entries.slice(0, 32)));
    }

    private removeLedger(identifier: string): void {
        this.writeLedger(this.ledger().filter((entry) => entry.identifier !== identifier));
    }

    private remember(entry: DailyLedgerEntry): void {
        this.writeLedger([...this.ledger().filter((item) => item.identifier !== entry.identifier), entry]);
    }

    private recent(now: Date): number[] {
        const cutoff = now.getTime() - HISTORY_MS;
        const raw = readJSON(this.options.store, DAILY_HISTORY_KEY);
        const history = new Map<number, number>();
        for (const item of Array.isArray(raw) ? raw.slice(-MAX_HISTORY) : []) {
            if (item && Number.isSafeInteger(item.movieId) && item.movieId > 0 && Number.isFinite(item.date) &&
                item.date >= cutoff && item.date <= now.getTime()) history.set(item.movieId, item.date);
        }
        const future: DailyLedgerEntry[] = [];
        for (const item of this.ledger()) {
            if (item.date > now.getTime()) future.push(item);
            else if (item.date >= cutoff) history.set(item.movieId, Math.max(history.get(item.movieId) ?? 0, item.date));
        }
        const entries: RecentPick[] = [...history].map(([movieId, date]) => ({movieId, date}))
            .sort((a, b) => a.date - b.date).slice(-MAX_HISTORY);
        this.options.store.set(DAILY_HISTORY_KEY, JSON.stringify(entries));
        this.writeLedger(future);
        return entries.map((item) => item.movieId);
    }

    private async cancel(identifier: string): Promise<void> {
        await this.options.delivery.cancel(identifier);
        this.removeLedger(identifier);
    }

    private async cancelAll(): Promise<void> {
        this.recent(this.now());
        const pending = await this.options.delivery.pending();
        let failure: unknown;
        for (const id of new Set([...pending, ...this.ledger().map((item) => item.identifier)])) {
            try {
                await this.cancel(id);
            } catch (error) {
                failure ??= error;
            }
        }
        if (failure) throw failure;
    }

    private cachedCatalog(quality: Quality): Catalog | null {
        const raw = readJSON(this.options.store, CATALOG_PREFIX + (quality || 'all'));
        if (!raw || typeof raw !== 'object' || !('fetchedAt' in raw) || !('movies' in raw) ||
            typeof raw.fetchedAt !== 'number' || !Number.isFinite(raw.fetchedAt)) return null;
        return {fetchedAt: raw.fetchedAt, movies: catalogMovies(raw.movies)};
    }

    private async catalog(quality: Quality, now: Date, force: boolean) {
        const cached = this.cachedCatalog(quality);
        const age = cached ? now.getTime() - cached.fetchedAt : Infinity;
        if (!force && cached && age >= 0 && age < CACHE_MS) {
            return {movies: cached.movies, fetched: false, failed: false};
        }
        try {
            return {movies: catalogMovies(await this.options.fetchMovies(quality)), fetched: true, failed: false};
        } catch {
            return {movies: cached?.movies ?? [], fetched: false, failed: true};
        }
    }

    private async run(force: boolean, forceFetch: boolean): Promise<number> {
        const snapshot = this.snapshot();
        if (!snapshot.enabled) {
            await this.cancelAll();
            return 0;
        }
        const now = this.now();
        this.recent(now);
        const pending = new Set(await this.options.delivery.pending());
        if (await this.changed(snapshot)) return 0;
        const activeDate = this.options.store.getString(LAST_ACTIVE_KEY);
        const todayId = DAILY_PREFIX + localNotificationDateKey(now);
        const obsolete = new Set([...pending, ...this.ledger().map((item) => item.identifier)].filter((id) =>
            snapshot.notify.dailyPicks
                ? !id.startsWith(DAILY_PREFIX) || (activeDate === localNotificationDateKey(now) && id === todayId)
                : id.startsWith(DAILY_PREFIX)));
        for (const identifier of obsolete) {
            await this.cancel(identifier);
            pending.delete(identifier);
            if (await this.changed(snapshot)) return 0;
        }
        const permission = await this.options.delivery.hasPermission();
        if (await this.changed(snapshot)) return 0;
        if (!permission) {
            await this.cancelAll();
            return 0;
        }
        const signature = notificationQuerySignature(snapshot.notify.quality);
        const knownSignature = this.seen.getQuerySignature() ?? notificationQuerySignature(DEFAULT_NOTIFICATION_PREFERENCES.quality);
        if (!snapshot.notify.dailyPicks && !force && signature === knownSignature &&
            this.seen.getLastRunDate() === localNotificationDateKey(now)) return 0;
        const catalog = await this.catalog(snapshot.notify.quality, now, forceFetch);
        if (await this.changed(snapshot)) return 0;
        const planningNow = this.now();
        const recentIds = this.recent(planningNow);
        if (catalog.fetched) {
            this.options.store.set(CATALOG_PREFIX + (snapshot.notify.quality || 'all'), JSON.stringify({
                fetchedAt: planningNow.getTime(), movies: catalog.movies,
            }));
        }
        if (snapshot.notify.dailyPicks) {
            return this.daily(snapshot, planningNow, catalog.movies, pending, recentIds);
        }
        if (catalog.failed) return 0;
        return this.legacy(snapshot, planningNow, catalog.movies, pending, signature, knownSignature);
    }

    private async daily(snapshot: Snapshot, now: Date, movies: Movie[], pending: Set<string>, recentIds: number[]): Promise<number> {
        const watchlist = catalogMovies(this.options.watchlist());
        const watched = this.options.watched();
        const allMovies = [...watchlist, ...movies];
        const excludedIds = allMovies.filter((movie) => watched.isWatched(movie.id)).map((movie) => movie.id);
        const input = {
            now, preferences: snapshot.notify, movies, watchlist, excludedIds, recentIds,
            lastActiveDate: this.options.store.getString(LAST_ACTIVE_KEY),
        };
        const slots = buildDailyMoviePicks(input);
        const eligibleIds = new Set(filterNotifiableMovies(allMovies, snapshot.notify)
            .filter((movie) => !watched.isWatched(movie.id) && !recentIds.includes(movie.id)).map((movie) => movie.id));
        const savedIds = new Set(watchlist.map((movie) => movie.id));
        const previous = new Map(this.ledger().map((item) => [item.identifier, item]));
        const desired = new Map<string, DailyLedgerEntry>();
        const retainedIds = new Set<number>();
        for (const slot of slots) {
            const entry = previous.get(slot.identifier);
            if (!entry || entry.date !== slot.date.getTime() || !eligibleIds.has(entry.movieId) ||
                entry.saved !== savedIds.has(entry.movieId) || retainedIds.has(entry.movieId)) continue;
            desired.set(entry.identifier, entry);
            retainedIds.add(entry.movieId);
        }
        const replacements = buildDailyMoviePicks({...input, excludedIds: [...excludedIds, ...retainedIds]});
        for (const slot of slots) {
            if (desired.has(slot.identifier)) continue;
            const pick = replacements.shift();
            if (!pick) continue;
            desired.set(slot.identifier, {
                identifier: slot.identifier,
                date: slot.date.getTime(),
                movieId: pick.movieId,
                saved: savedIds.has(pick.movieId),
                content: {...pick.content, data: {movieId: pick.movieId, kind: 'daily-pick', dateKey: localNotificationDateKey(slot.date)}},
            });
        }
        for (const identifier of new Set([...pending, ...previous.keys()])) {
            if (!identifier.startsWith(DAILY_PREFIX)) continue;
            const wanted = desired.get(identifier);
            if (wanted && samePick(previous.get(identifier), wanted)) continue;
            await this.cancel(identifier);
            pending.delete(identifier);
            if (await this.changed(snapshot)) return 0;
        }
        let scheduled = 0;
        let failure: unknown;
        for (const entry of desired.values()) {
            if (pending.has(entry.identifier) && samePick(previous.get(entry.identifier), entry)) continue;
            if (await this.changed(snapshot)) return scheduled;
            if (entry.date <= this.now().getTime()) continue;
            try {
                await this.options.delivery.schedule({identifier: entry.identifier, date: new Date(entry.date), content: entry.content});
            } catch (error) {
                failure ??= error;
                if (await this.changed(snapshot)) return scheduled;
                continue;
            }
            if (!this.current(snapshot)) {
                await this.cancel(entry.identifier);
                await this.changed(snapshot);
                return scheduled;
            }
            this.remember(entry);
            pending.add(entry.identifier);
            scheduled++;
        }
        if (failure) throw failure;
        return scheduled;
    }

    private async legacy(snapshot: Snapshot, now: Date, movies: Movie[], pending: Set<string>, signature: string, knownSignature: string): Promise<number> {
        const today = localNotificationDateKey(now);
        const cachedIds = signature === knownSignature ? this.seen.getSeenIds() : new Set<number>();
        if (cachedIds.size === 0) {
            this.seen.setSeenIds(movies.map((movie) => movie.id));
            this.seen.setQuerySignature(signature);
            this.seen.setLastRunDate(today);
            return 0;
        }
        const fresh = selectNewMovies(cachedIds, movies);
        const watched = this.options.watched();
        const matched = filterNotifiableMovies(fresh, snapshot.notify).filter((movie) => !watched.isWatched(movie.id));
        const matchedIds = new Set(matched.map((movie) => movie.id));
        const completed = new Set([...cachedIds, ...movies.filter((movie) => !matchedIds.has(movie.id)).map((movie) => movie.id)]);
        const persist = () => {
            this.seen.setSeenIds([...completed].slice(-MAX_SEEN));
            this.seen.setQuerySignature(signature);
        };
        if (matched.length === 0) {
            persist();
            this.seen.setLastRunDate(today);
            return 0;
        }
        this.options.store.delete(LAST_RUN_KEY);
        let scheduled = 0;
        let failure: unknown;
        for (const content of buildNotificationBatch(matched, snapshot.notify.perTitle, NOTIFICATION_BURST_LIMIT)) {
            const ids = 'movieId' in content.data ? [content.data.movieId] : [...matchedIds];
            const identifier = batchIdentifier(snapshot.notify.quality, ids);
            if (await this.changed(snapshot)) return scheduled;
            if (!pending.has(identifier)) {
                const date = snapshot.notify.quietHours
                    ? quietHoursEndAt(this.now(), snapshot.notify.quietStartHour, snapshot.notify.quietEndHour) : null;
                try {
                    await this.options.delivery.schedule({identifier, content, date});
                } catch (error) {
                    failure ??= error;
                    if (await this.changed(snapshot)) return scheduled;
                    continue;
                }
                if (!this.current(snapshot)) {
                    await this.cancel(identifier);
                    await this.changed(snapshot);
                    return scheduled;
                }
                pending.add(identifier);
                scheduled += ids.length;
            }
            for (const id of ids) completed.add(id);
            persist();
        }
        if (failure) throw failure;
        this.seen.setLastRunDate(today);
        return scheduled;
    }
}
