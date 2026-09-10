import type {AuthRepository, PurchaseRepository} from '@/domain';

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

export class SubscriberCatalogAccess {
    private context: string | null;
    private generation = 0;
    private retryAt = 0;
    private readonly active = new Set<AbortController>();

    constructor(private readonly auth: AuthRepository, private readonly purchases: PurchaseRepository) {
        this.context = this.readContext();
        auth.subscribe(() => this.refreshContext());
        purchases.subscribe(() => this.refreshContext());
    }

    async load<T>(url: string, parse: (metadata: unknown) => T): Promise<{value: T} | null> {
        this.refreshContext();
        const context = this.context;
        if (context === null || this.retryAt > Date.now()) return null;
        const generation = this.generation;
        const controller = new AbortController();
        this.active.add(controller);
        const current = () => {
            this.refreshContext();
            return this.context === context && this.generation === generation;
        };
        const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
        try {
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
            if (PUBLIC_FALLBACK_STATUSES.has(response.status)) {
                this.retryAt = Date.now() + ACCESS_BACKOFF_MS;
                return null;
            }
            if (!response.ok) throw new Error('Subscriber catalog request failed.');
            const envelope: unknown = await abortable(response.json(), controller.signal);
            if (!current()) return null;
            if (envelope === null || typeof envelope !== 'object' || Array.isArray(envelope) ||
                !Object.hasOwn(envelope, 'metadata')) throw new Error('Invalid subscriber catalog response.');
            const value = parse((envelope as {metadata: unknown}).metadata);
            if (!current()) return null;
            return {value};
        } catch {
            if (!current()) return null;
            throw new Error(controller.signal.aborted
                ? 'The catalog request timed out. Please try again.'
                : 'The catalog is unavailable. Please try again.');
        } finally {
            clearTimeout(timeout);
            this.active.delete(controller);
        }
    }

    private readContext(): string | null {
        const session = this.auth.getSession();
        const state = this.purchases.getState();
        if (!session.ready || !session.account?.uid || !state.ready || !state.adsRemoved) return null;
        return JSON.stringify([session.account.uid, state.expiresAt]);
    }

    private refreshContext(): void {
        const next = this.readContext();
        if (next === this.context) return;
        this.context = next;
        this.generation++;
        this.retryAt = 0;
        for (const controller of this.active) controller.abort();
    }
}
