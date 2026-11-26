import type {Haptics} from './haptics';

export type {Haptics};

export const haptics: Haptics = {
  select: () => undefined,
  commit: () => undefined,
  warn: () => undefined,
};

export function useHaptics(): Haptics {
  return haptics;
}
