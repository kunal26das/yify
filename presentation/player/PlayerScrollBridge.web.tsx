import {useEffect, useRef} from 'react';
import type {PlayerScrollBridgeProps} from './PlayerScrollBridge';
import {createPlayerScrollRelay} from './playerScrollRelay';

export function PlayerScrollBridge({active, targetId, width, height, children}: PlayerScrollBridgeProps) {
    const viewportRef = useRef<HTMLDivElement>(null);
    const trackRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const viewport = viewportRef.current;
        const track = trackRef.current;
        if (!viewport || !track) return;

        const reset = () => {
            track.style.height = `${height}px`;
            viewport.scrollTop = 0;
        };
        if (!active) {
            reset();
            return;
        }

        const document = viewport.ownerDocument;
        const window = document.defaultView;
        if (!window) return;
        let target: HTMLElement | null = null;
        let relay: ReturnType<typeof createPlayerScrollRelay> | null = null;
        let disposed = false;
        const watched = new Set<Element>();

        const visible = (element: HTMLElement) => {
            if (!element.isConnected || element.clientHeight <= 0 || element.getClientRects().length === 0) return false;
            if (element.closest('[aria-hidden="true"]')) return false;
            if (window.getComputedStyle(element).visibility === 'hidden') return false;
            const rect = element.getBoundingClientRect();
            return rect.bottom > 0 && rect.right > 0 && rect.top < window.innerHeight && rect.left < window.innerWidth;
        };

        const reconcile = () => {
            if (disposed) return;
            const candidates = Array.from(document.querySelectorAll<HTMLElement>(`[id="${CSS.escape(targetId)}"]`));
            const next = candidates.reverse().find(visible) ?? null;
            if (next !== target) {
                relay?.dispose();
                target = next;
                relay = target ? createPlayerScrollRelay({viewport, track, target, height}) : null;
                if (!relay) reset();
            }
            relay?.refresh();
            const elements = new Set<Element>([...candidates, ...(target ? Array.from(target.children) : [])]);
            for (const element of watched) {
                if (elements.has(element)) continue;
                resizeObserver.unobserve(element);
                watched.delete(element);
            }
            for (const element of elements) {
                if (watched.has(element)) continue;
                resizeObserver.observe(element);
                watched.add(element);
            }
        };

        const resizeObserver = new ResizeObserver(reconcile);
        const mutationObserver = new MutationObserver(reconcile);
        mutationObserver.observe(document.body, {
            childList: true,
            subtree: true,
            attributes: true,
            attributeFilter: ['id', 'hidden', 'aria-hidden'],
        });
        window.addEventListener('resize', reconcile);
        reconcile();

        return () => {
            disposed = true;
            relay?.dispose();
            resizeObserver.disconnect();
            mutationObserver.disconnect();
            window.removeEventListener('resize', reconcile);
            reset();
        };
    }, [active, height, targetId]);

    return (
        <div
            ref={viewportRef}
            style={{width, height, overflowX: 'hidden', overflowY: active ? 'auto' : 'hidden', scrollbarWidth: 'none'}}
        >
            <div ref={trackRef} style={{height, position: 'relative'}}>
                <div style={{width, height, position: 'sticky', top: 0}}>
                    {children}
                </div>
            </div>
        </div>
    );
}
