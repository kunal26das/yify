import type {ReactNode} from 'react';
import type {Movie} from '@/domain';

export function HoverCardHost({children}: {children: ReactNode}) {
    return <>{children}</>;
}

export interface HoverCardController {
    open: (movie: Movie, anchor: unknown, source: string) => void;
    close: () => void;
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
