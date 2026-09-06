import {useMemo} from 'react';
import * as Haptics from 'expo-haptics';

export interface Haptic {
    select(): void;

    commit(): void;

    warn(): void;
}

export function useHaptics(): Haptic {
    return useMemo(
        () => ({
            select: () => {
                void Haptics.selectionAsync().catch(() => {
                });
            },
            commit: () => {
                void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {
                });
            },
            warn: () => {
                void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {
                });
            },
        }),
        []
    );
}
