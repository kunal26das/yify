import type {ReactNode} from 'react';
import type {Movie} from '@/domain';

/**
 * Native stub for the web hover-expand card.
 *
 * Hover is a pointer-only affordance, so on iOS/Android the host is a pass-through and the poster's
 * open/close calls do nothing. Metro serves HoverCard.web.tsx in its place on web.
 */
export function HoverCardHost({children}: {children: ReactNode}) {
    return <>{children}</>;
}

export interface HoverCardController {
    open: (movie: Movie, anchor: unknown, source: string) => void;
    close: () => void;
    /** False on platforms without hover, so posters can skip measuring entirely. */
    enabled: boolean;
}

const NOOP: HoverCardController = {
    open: () => {},
    close: () => {},
    enabled: false,
};

export function useHoverCard(): HoverCardController {
    return NOOP;
}
