import type {PreferenceStamps, Preferences, PreferencesSectionState} from '@/core/domain/preferences';
import {DEFAULT_PREFERENCES} from '@/core/domain/preferences';
import type {SyncedStoreAccess} from '@/core/domain/sync/types';
import {createStore, useStore} from '@/core/store/createStore';

interface PreferencesRecord {
  rev: number;
  state: PreferencesSectionState;
}

const ZERO_STAMPS: PreferenceStamps = {theme: 0, accent: 0, region: 0, services: 0, recentPaused: 0, trailerCaptions: 0};
const INITIAL: PreferencesRecord = {rev: 0, state: {values: DEFAULT_PREFERENCES, stamps: ZERO_STAMPS}};

const preferencesStore = createStore<PreferencesRecord>({load: () => INITIAL, serverState: INITIAL});

export function usePreferences<T>(select: (preferences: Preferences) => T, equals?: (a: T, b: T) => boolean): T {
  return useStore(preferencesStore, (record) => select(record.state.values), equals);
}

export function getPreferences(): Preferences {
  return preferencesStore.get().state.values;
}

export function setPreference<K extends keyof Preferences>(key: K, value: Preferences[K]): void {
  preferencesStore.set((record) => {
    if (Object.is(record.state.values[key], value)) return record;
    return {
      rev: record.rev + 1,
      state: {values: {...record.state.values, [key]: value}, stamps: {...record.state.stamps, [key]: Date.now()}},
    };
  });
}

export const preferencesSyncAccess: SyncedStoreAccess<PreferencesSectionState> = {
  read: () => preferencesStore.get(),
  apply: (state) => preferencesStore.set((record) => ({rev: record.rev + 1, state})),
  subscribe: (listener) => preferencesStore.subscribe(listener),
  reset: () => preferencesStore.set(() => INITIAL),
};
