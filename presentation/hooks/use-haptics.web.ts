import {useMemo} from 'react';

export interface Haptic {
    select(): void;

    commit(): void;

    warn(): void;
}

export function useHaptics(): Haptic {
    return useMemo(
        () => ({
            select: () => {
            },
            commit: () => {
            },
            warn: () => {
            },
        }),
        []
    );
}
