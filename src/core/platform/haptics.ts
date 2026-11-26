import {NotificationFeedbackType, notificationAsync, selectionAsync} from 'expo-haptics';

export interface Haptics {
  select(): void;
  commit(): void;
  warn(): void;
}

function fire(work: () => Promise<void>): void {
  try {
    void work().catch(() => undefined);
  } catch {
    return;
  }
}

export const haptics: Haptics = {
  select: () => fire(() => selectionAsync()),
  commit: () => fire(() => notificationAsync(NotificationFeedbackType.Success)),
  warn: () => fire(() => notificationAsync(NotificationFeedbackType.Warning)),
};

export function useHaptics(): Haptics {
  return haptics;
}
