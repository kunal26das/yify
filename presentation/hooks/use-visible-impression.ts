import {useCallback, useEffect, useRef, type ComponentRef, type RefObject} from 'react';
import {useWindowDimensions, type View} from 'react-native';
import {usePreviewActive} from './use-preview-active';

type Rectangle = {x: number; y: number; width: number; height: number};

export function visibleFraction(target: Rectangle, viewport: Rectangle, topInset: number): number {
    if (![...Object.values(target), ...Object.values(viewport), topInset].every(Number.isFinite) ||
        target.width <= 0 || target.height <= 0 || viewport.width <= 0 || viewport.height <= 0 || topInset < 0) return 0;
    const width = Math.max(0, Math.min(target.x + target.width, viewport.x + viewport.width) - Math.max(target.x, viewport.x));
    const height = Math.max(0, Math.min(target.y + target.height, viewport.y + viewport.height) - Math.max(target.y, viewport.y + topInset));
    return width * height / (target.width * target.height);
}

export function useVisibleImpression({enabled, targetRef, viewportRef, topInset, onImpression}: {
    enabled: boolean;
    targetRef: RefObject<ComponentRef<typeof View> | null>;
    viewportRef?: RefObject<ComponentRef<typeof View> | null>;
    topInset: number;
    onImpression: () => void;
}): () => void {
    const active = usePreviewActive(enabled);
    const dimensions = useWindowDimensions();
    const current = useRef({active, topInset, onImpression});
    current.current = {active, topInset, onImpression};
    const recorded = useRef(false);
    const visibleSince = useRef<number | null>(null);
    const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const frame = useRef<number | null>(null);
    const generation = useRef(0);
    const reset = useCallback(() => {
        if (timer.current !== null) clearTimeout(timer.current);
        timer.current = null;
        visibleSince.current = null;
    }, []);
    const check = useCallback(() => {
        const revision = ++generation.current;
        if (frame.current !== null) cancelAnimationFrame(frame.current);
        frame.current = null;
        if (!current.current.active || recorded.current) {
            reset();
            return;
        }
        frame.current = requestAnimationFrame(() => {
            frame.current = null;
            const target = targetRef.current;
            const viewport = viewportRef?.current;
            if (!target?.measureInWindow || !viewport?.measureInWindow) {
                reset();
                return;
            }
            target.measureInWindow((x, y, width, height) => {
                viewport.measureInWindow((vx, vy, vw, vh) => {
                    if (revision !== generation.current || !current.current.active || recorded.current) return;
                    const fraction = visibleFraction({x, y, width, height}, {x: vx, y: vy, width: vw, height: vh}, current.current.topInset);
                    if (fraction < 0.5) {
                        reset();
                        return;
                    }
                    const now = Date.now();
                    visibleSince.current ??= now;
                    const remaining = 1000 - (now - visibleSince.current);
                    if (remaining <= 0) {
                        recorded.current = true;
                        reset();
                        current.current.onImpression();
                    } else if (timer.current === null) {
                        timer.current = setTimeout(() => {
                            timer.current = null;
                            check();
                        }, remaining);
                    }
                });
            });
        });
    }, [reset, targetRef, viewportRef]);
    useEffect(() => {
        check();
        return () => {
            generation.current++;
            if (frame.current !== null) cancelAnimationFrame(frame.current);
            frame.current = null;
            reset();
        };
    }, [active, topInset, dimensions.width, dimensions.height, dimensions.fontScale, check, reset]);
    return check;
}
