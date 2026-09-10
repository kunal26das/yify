import type {DisplayAds, DisplayAdState, PurchaseRepository} from '@/domain';

const CLIENT = 'ca-pub-2292299294214510';
const SLOT = '8399492432';
const SCRIPT_URL = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${CLIENT}`;
const scriptLoads = new WeakMap<Document, Promise<boolean>>();

type AdsWindow = Window & {
    adsbygoogle?: {push(value: Record<string, never>): unknown};
    yifyDesktop?: {isDesktop?: boolean};
};

interface Attachment {
    state: DisplayAdState;
    listeners: Set<(state: DisplayAdState) => void>;
    references: number;
    dispose(): void;
}

function loadScript(document: Document): Promise<boolean> {
    const pending = scriptLoads.get(document);
    if (pending) return pending;
    const result = new Promise<boolean>((resolve) => {
        const script = document.createElement('script');
        script.async = true;
        script.src = SCRIPT_URL;
        script.crossOrigin = 'anonymous';
        script.setAttribute('data-yify-adsense', 'true');
        let finished = false;
        const settle = (loaded: boolean) => {
            if (finished) return;
            finished = true;
            clearTimeout(timeout);
            script.removeEventListener('load', loadedScript);
            script.removeEventListener('error', failedScript);
            if (!loaded) script.remove();
            resolve(loaded);
        };
        const loadedScript = () => settle(true);
        const failedScript = () => settle(false);
        const timeout = setTimeout(failedScript, 15000);
        script.addEventListener('load', loadedScript);
        script.addEventListener('error', failedScript);
        try {
            document.head.appendChild(script);
        } catch {
            settle(false);
        }
    });
    scriptLoads.set(document, result);
    return result;
}

function notify(listener: (state: DisplayAdState) => void, state: DisplayAdState): void {
    try {
        listener(state);
    } catch {
    }
}

export class AdSenseDisplayAds implements DisplayAds {
    private readonly attachments = new Map<HTMLElement, Attachment>();

    constructor(private readonly purchases: PurchaseRepository) {
    }

    get supported(): boolean {
        if (typeof window === 'undefined' || typeof document === 'undefined' ||
            (typeof __DEV__ !== 'undefined' && __DEV__) ||
            process.env.EXPO_PUBLIC_SENTRY_ENVIRONMENT === 'preview') return false;
        const browser = window as AdsWindow;
        if (browser.yifyDesktop?.isDesktop || /Electron/i.test(window.navigator.userAgent)) return false;
        const {protocol, hostname, pathname, port} = window.location;
        if (protocol !== 'https:' || port) return false;
        return hostname === 'yify.expo.app' ||
            (hostname === 'kunal26das.github.io' && (pathname === '/yify' || pathname.startsWith('/yify/')));
    }

    attach(containerId: string, onStateChange?: (state: DisplayAdState) => void): () => void {
        if (!this.supported) {
            if (onStateChange) notify(onStateChange, 'disabled');
            return () => {};
        }
        const container = document.getElementById(containerId);
        if (!container) {
            if (onStateChange) notify(onStateChange, 'disabled');
            return () => {};
        }
        let attachment = this.attachments.get(container);
        if (!attachment) {
            attachment = this.createAttachment(container);
            this.attachments.set(container, attachment);
        }
        attachment.references++;
        if (onStateChange) {
            attachment.listeners.add(onStateChange);
            notify(onStateChange, attachment.state);
        }
        let released = false;
        return () => {
            if (released) return;
            released = true;
            if (onStateChange) attachment.listeners.delete(onStateChange);
            if (--attachment.references > 0) return;
            attachment.dispose();
            this.attachments.delete(container);
        };
    }

    private createAttachment(container: HTMLElement): Attachment {
        let disposed = false;
        let ended = false;
        let loadingScript = false;
        let requested = false;
        let ad: HTMLElement | null = null;
        let statusObserver: MutationObserver | null = null;
        let resizeObserver: ResizeObserver | null = null;
        const attachment: Attachment = {
            state: 'loading',
            listeners: new Set(),
            references: 0,
            dispose: () => {
                disposed = true;
                unsubscribe();
                cleanUp();
                attachment.listeners.clear();
            },
        };
        const setState = (state: DisplayAdState) => {
            if (disposed) return;
            attachment.state = state;
            container.setAttribute('data-display-ad-state', state);
            for (const listener of attachment.listeners) notify(listener, state);
        };
        const cleanUp = () => {
            resizeObserver?.disconnect();
            statusObserver?.disconnect();
            ad?.remove();
            ad = null;
        };
        const stop = (state: DisplayAdState) => {
            ended = true;
            cleanUp();
            setState(state);
        };
        const permitted = () => {
            const state = this.purchases.getState();
            return this.supported && state.ready && !state.adsRemoved;
        };
        const readStatus = () => {
            const status = ad?.getAttribute('data-ad-status');
            if (status !== 'filled' && status !== 'unfilled' && status !== 'unfill-optimized') return;
            if (ad) ad.style.display = status === 'unfilled' ? 'none' : 'block';
            setState(status);
        };
        const start = async () => {
            if (disposed || ended || loadingScript || requested) return;
            if (!permitted()) {
                setState('disabled');
                return;
            }
            if (!container.isConnected || container.getBoundingClientRect().width <= 0) return;
            loadingScript = true;
            setState('loading');
            const loaded = await loadScript(container.ownerDocument);
            loadingScript = false;
            if (disposed || ended) return;
            if (!permitted()) { stop('disabled'); return; }
            if (!loaded) { stop('blocked'); return; }
            if (!container.isConnected || container.getBoundingClientRect().width <= 0) return;
            requested = true;
            resizeObserver?.disconnect();
            ad = container.ownerDocument.createElement('ins');
            ad.className = 'adsbygoogle';
            ad.style.display = 'block';
            ad.setAttribute('data-ad-client', CLIENT);
            ad.setAttribute('data-ad-slot', SLOT);
            ad.setAttribute('data-ad-format', 'auto');
            ad.setAttribute('data-full-width-responsive', 'true');
            container.appendChild(ad);
            statusObserver = new MutationObserver(readStatus);
            statusObserver.observe(ad, {attributes: true, attributeFilter: ['data-ad-status']});
            const browser = window as AdsWindow;
            browser.adsbygoogle ??= [];
            browser.adsbygoogle.push({});
            readStatus();
        };
        const schedule = () => {
            void Promise.resolve().then(start).catch(() => {
                if (!disposed) stop('blocked');
            });
        };
        const unsubscribe = this.purchases.subscribe(() => {
            if (disposed || ended) return;
            if (!permitted() && (requested || loadingScript)) stop('disabled');
            else schedule();
        });
        if (typeof ResizeObserver !== 'undefined') {
            resizeObserver = new ResizeObserver(schedule);
            resizeObserver.observe(container);
        }
        schedule();
        return attachment;
    }
}
