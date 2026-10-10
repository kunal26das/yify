import type {NetworkMonitor} from '@/domain';
import {watchForeground} from '../datasources/platform/ForegroundWatcher';

const PROBE_TIMEOUT_MS = 3000;
const ONLINE_PROOF_MS = 30000;
const OFFLINE_PROOF_MS = 3000;
const OFFLINE_RETRY_MS = 10000;

export class ExpoNetworkMonitor implements NetworkMonitor {
    private online = true;
    private readonly listeners = new Set<() => void>();
    private revision = 0;
    private proof: {online: boolean; at: number} | null = null;
    private probe: {revision: number; promise: Promise<boolean>} | null = null;
    private stopForeground: (() => void) | null = null;
    private retryTimer: ReturnType<typeof setTimeout> | null = null;

    private readonly onOnline = () => {
        this.revision++;
        this.proof = null;
        this.setOnline(true);
    };

    private readonly onOffline = () => {
        this.revision++;
        this.proof = null;
        void this.refresh();
    };

    constructor() {
        void this.refresh();
    }

    isOnline(): boolean {
        return this.online;
    }

    refresh(): Promise<boolean> {
        if (typeof window === 'undefined' || typeof navigator === 'undefined') return Promise.resolve(this.online);
        if (navigator.onLine !== false) {
            this.revision++;
            this.proof = null;
            this.setOnline(true);
            return Promise.resolve(true);
        }
        const proof = this.proof;
        if (proof && Date.now() - proof.at < (proof.online ? ONLINE_PROOF_MS : OFFLINE_PROOF_MS)) {
            return Promise.resolve(proof.online);
        }
        if (this.probe?.revision === this.revision) return this.probe.promise;

        this.clearRetry();
        const revision = this.revision;
        const controller = new AbortController();
        let timer: ReturnType<typeof setTimeout>;
        const timeout = new Promise<boolean>(resolve => {
            timer = setTimeout(() => {
                controller.abort();
                resolve(false);
            }, PROBE_TIMEOUT_MS);
        });
        const request = Promise.resolve()
            .then(() => fetch(new URL(window.location.pathname, window.location.origin).href, {
                method: 'HEAD', credentials: 'omit', cache: 'no-store', redirect: 'manual', signal: controller.signal,
            }))
            .then(() => true, () => false);
        const promise = Promise.race([request, timeout])
            .then(reachable => {
                if (revision === this.revision) {
                    const next = navigator.onLine !== false || reachable;
                    this.proof = {online: next, at: Date.now()};
                    this.setOnline(next);
                }
                return this.online;
            })
            .finally(() => {
                clearTimeout(timer);
                if (this.probe?.revision === revision) this.probe = null;
            });
        this.probe = {revision, promise};
        return promise;
    }

    subscribe(listener: () => void): () => void {
        this.listeners.add(listener);
        if (this.listeners.size === 1 && typeof window !== 'undefined') {
            window.addEventListener('online', this.onOnline);
            window.addEventListener('offline', this.onOffline);
            this.stopForeground = watchForeground(() => {
                this.proof = null;
                void this.refresh();
            });
            if (!this.probe) this.proof = null;
            void this.refresh();
        }
        return () => {
            this.listeners.delete(listener);
            if (this.listeners.size === 0 && typeof window !== 'undefined') {
                window.removeEventListener('online', this.onOnline);
                window.removeEventListener('offline', this.onOffline);
                this.stopForeground?.();
                this.stopForeground = null;
                this.clearRetry();
            }
        };
    }

    private setOnline(next: boolean): void {
        if (next !== this.online) {
            this.online = next;
            this.listeners.forEach(listener => listener());
        }
        if (next) this.clearRetry();
        else this.scheduleRetry();
    }

    private scheduleRetry(): void {
        if (this.retryTimer || this.online || this.listeners.size === 0
            || typeof document === 'undefined' || document.visibilityState !== 'visible') return;
        this.retryTimer = setTimeout(() => {
            this.retryTimer = null;
            if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
                this.proof = null;
                void this.refresh();
            }
        }, OFFLINE_RETRY_MS);
    }

    private clearRetry(): void {
        if (this.retryTimer === null) return;
        clearTimeout(this.retryTimer);
        this.retryTimer = null;
    }
}
