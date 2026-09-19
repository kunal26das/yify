import type {AuthRepository, PurchaseRepository, SubscriberAccess, SubscriberAccessState} from '@/domain';
import {RequestCancelledError} from '../datasources/JsonRequest';

const ACCESS_BACKOFF_MS = 30_000;
const REQUEST_TIMEOUT_MS = 30_000;
const PUBLIC_FALLBACK_STATUSES = new Set([401, 403, 503]);

function abortable<T>(work: Promise<T>, signal: AbortSignal): Promise<T> {
    return new Promise((resolve, reject) => {
        const abort = () => reject(new Error('Subscriber catalog request was interrupted.'));
        signal.addEventListener('abort', abort, {once: true});
        work.then(resolve, reject).finally(() => signal.removeEventListener('abort', abort));
        if (signal.aborted) abort();
    });
}

export class SubscriberCatalogAccess implements SubscriberAccess {
    private context: string | null;
    private authReady: boolean;
    private state: SubscriberAccessState;
    private generation = 0;
    private accessGeneration = 0;
    private retryAt = 0;
    private readonly active = new Set<AbortController>();
    private readonly listeners = new Set<() => void>();
    private accessCheck?: {context: string; generation: number; accessGeneration: number; controller: AbortController; promise: Promise<void>};
    private expiryTimer?: ReturnType<typeof setTimeout>;
    private checkedExpiry?: string;

    constructor(private readonly auth: AuthRepository, private readonly purchases: PurchaseRepository,
        private readonly accessUrl: () => string = () => 'https://yify.expo.app/api/subscriber-catalog/access?v=2') {
        this.context = this.readContext();
        this.authReady = auth.getSession().ready;
        this.state = this.context !== null || !this.authReady ? 'checking' : 'denied';
        auth.subscribe(() => this.refreshContext());
        purchases.subscribe(() => this.refreshContext());
    }

    getState(): SubscriberAccessState { return this.state; }

    subscribe(listener: () => void): () => void {
        this.listeners.add(listener);
        if (this.listeners.size === 1) void this.refresh();
        this.scheduleExpiryCheck();
        return () => {
            this.listeners.delete(listener);
            if (!this.listeners.size && this.expiryTimer !== undefined) {
                clearTimeout(this.expiryTimer);
                this.expiryTimer = undefined;
            }
        };
    }

    refresh(): Promise<void> {
        this.refreshContext(false);
        const context = this.context;
        if (context === null) return Promise.resolve();
        const expiry = this.purchases.getState().expiresAt;
        if (expiry && Number.isFinite(Date.parse(expiry)) && Date.parse(expiry) <= Date.now() && expiry !== this.checkedExpiry) {
            this.checkedExpiry = expiry;
            this.invalidateAccess('checking');
        }
        const generation = this.generation;
        const accessGeneration = this.accessGeneration;
        if (this.accessCheck?.context === context && this.accessCheck.generation === generation) {
            return this.accessCheck.promise;
        }
        if (this.state !== 'allowed') this.setState('checking');
        const controller = new AbortController();
        this.active.add(controller);
        const current = () => this.context === context && this.generation === generation && this.accessGeneration === accessGeneration;
        const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
        // Defer work so concurrent observers receive the same recorded promise.
        const promise = Promise.resolve().then(async () => {
            try {
                if (!current()) return;
                const token = await abortable(this.auth.getIdToken(), controller.signal);
                if (!current()) return;
                if (!token) throw new Error('Subscriber verification is unavailable.');
                const response = await abortable(fetch(this.accessUrl(), {
                    signal: controller.signal, redirect: 'error', credentials: 'omit', cache: 'no-store',
                    headers: {Accept: 'application/json', Authorization: `Bearer ${token}`},
                }), controller.signal);
                if (!current()) return;
                if (!response.ok) {
                    // Verification never exposes the source response or falls back to public access.
                    this.setState(response.status === 401 || response.status === 403 ? 'denied' : 'unavailable');
                    try { await abortable(response.text(), controller.signal); } catch {}
                    return;
                }
                const envelope: unknown = await abortable(response.json(), controller.signal);
                if (!current()) return;
                if (envelope === null || typeof envelope !== 'object' || Array.isArray(envelope) ||
                    !Object.hasOwn(envelope, 'metadata')) throw new Error('Invalid access response.');
                const metadata = (envelope as {metadata: unknown}).metadata;
                if (metadata === null || typeof metadata !== 'object' || Array.isArray(metadata) ||
                    Object.keys(metadata).length !== 1 || !Object.hasOwn(metadata, 'allowed') ||
                    (metadata as {allowed: unknown}).allowed !== true) throw new Error('Invalid access response.');
                this.retryAt = 0;
                const latestExpiry = this.purchases.getState().expiresAt;
                if (latestExpiry && Date.parse(latestExpiry) <= Date.now()) this.checkedExpiry = latestExpiry;
                this.setState('allowed');
            } catch {
                if (current()) this.setState('unavailable');
            } finally {
                clearTimeout(timer);
                this.active.delete(controller);
                if (this.accessCheck?.promise === promise) this.accessCheck = undefined;
            }
        });
        this.accessCheck = {context, generation, accessGeneration, controller, promise};
        return promise;
    }

    async load<T>(url: string, parse: (metadata: unknown) => T, signal?: AbortSignal): Promise<{value: T} | null> {
        if (signal?.aborted) throw new RequestCancelledError();
        this.refreshContext();
        const context = this.context;
        if (context === null || this.retryAt > Date.now()) return null;
        const generation = this.generation;
        const controller = new AbortController();
        const cancel = () => controller.abort();
        signal?.addEventListener('abort', cancel, {once: true});
        if (signal?.aborted) cancel();
        this.active.add(controller);
        const current = () => {
            if (signal?.aborted) throw new RequestCancelledError();
            this.refreshContext();
            return this.context === context && this.generation === generation;
        };
        const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
        try {
            if (signal?.aborted) throw new RequestCancelledError();
            let token: string | null;
            try {
                token = await abortable(this.auth.getIdToken(), controller.signal);
            } catch {
                if (current()) this.retryAt = Date.now() + ACCESS_BACKOFF_MS;
                return null;
            }
            if (!current() || controller.signal.aborted) return null;
            if (!token) {
                this.retryAt = Date.now() + ACCESS_BACKOFF_MS;
                return null;
            }
            const response = await abortable(fetch(url, {
                signal: controller.signal,
                redirect: 'error',
                credentials: 'omit',
                cache: 'no-store',
                headers: {Accept: 'application/json', Authorization: `Bearer ${token}`},
            }), controller.signal);
            if (!current()) return null;
            if (!response.ok) {
                if (PUBLIC_FALLBACK_STATUSES.has(response.status) && new URL(url).pathname.endsWith('/anime')) {
                    this.invalidateAccess(response.status === 401 || response.status === 403 ? 'denied' : 'unavailable');
                }
                try {
                    await abortable(response.text(), controller.signal);
                } catch {}
                if (!current()) return null;
                if (PUBLIC_FALLBACK_STATUSES.has(response.status)) {
                    this.retryAt = Date.now() + ACCESS_BACKOFF_MS;
                    return null;
                }
                throw new Error('Subscriber catalog request failed.');
            }
            const envelope: unknown = await abortable(response.json(), controller.signal);
            if (!current()) return null;
            if (envelope === null || typeof envelope !== 'object' || Array.isArray(envelope) ||
                !Object.hasOwn(envelope, 'metadata')) throw new Error('Invalid subscriber catalog response.');
            const value = parse((envelope as {metadata: unknown}).metadata);
            if (!current()) return null;
            return {value};
        } catch {
            if (signal?.aborted) throw new RequestCancelledError();
            if (!current()) return null;
            throw new Error(controller.signal.aborted
                ? 'The catalog request timed out. Please try again.'
                : 'The catalog is unavailable. Please try again.');
        } finally {
            clearTimeout(timeout);
            signal?.removeEventListener('abort', cancel);
            this.active.delete(controller);
        }
    }

    private readContext(): string | null {
        const session = this.auth.getSession();
        const state = this.purchases.getState();
        if (!session.ready || !session.account?.uid) return null;
        return JSON.stringify([session.account.uid, state.adsRemoved, state.expiresAt, state.willRenew, state.billingIssue]);
    }

    private setState(state: SubscriberAccessState): void {
        const changed = this.state !== state;
        this.state = state;
        this.scheduleExpiryCheck();
        if (changed) for (const listener of [...this.listeners]) listener();
    }

    private invalidateAccess(state: SubscriberAccessState): void {
        this.accessGeneration++;
        this.accessCheck?.controller.abort();
        this.accessCheck = undefined;
        this.setState(state);
    }

    private scheduleExpiryCheck(): void {
        if (this.expiryTimer !== undefined) clearTimeout(this.expiryTimer);
        this.expiryTimer = undefined;
        const expiry = this.purchases.getState().expiresAt;
        if (!this.listeners.size || this.state !== 'allowed' || !expiry || expiry === this.checkedExpiry) return;
        const remaining = Date.parse(expiry) - Date.now();
        if (!Number.isFinite(remaining) || remaining <= 0) return;
        this.expiryTimer = setTimeout(() => {
            this.expiryTimer = undefined;
            if (Date.parse(expiry) > Date.now()) {this.scheduleExpiryCheck(); return;}
            this.checkedExpiry = expiry;
            this.invalidateAccess('checking');
            void this.refresh();
        }, Math.min(remaining, 2_147_483_647));
    }

    private refreshContext(recheck = true): void {
        const next = this.readContext();
        const ready = this.auth.getSession().ready;
        if (next === this.context && ready === this.authReady) return;
        this.context = next;
        this.authReady = ready;
        this.generation++;
        this.retryAt = 0;
        this.checkedExpiry = undefined;
        this.accessCheck = undefined;
        for (const controller of this.active) controller.abort();
        this.setState(next !== null || !ready ? 'checking' : 'denied');
        if (recheck && this.listeners.size && next !== null) void this.refresh();
    }
}
