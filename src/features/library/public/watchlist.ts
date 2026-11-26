import type {EntryKey} from '@/core/domain/keys';
import type {LibraryEntry, TitleSnapshot} from '@/core/domain/library';
import {createStore, useStore} from '@/core/store/createStore';

export type ToggleResult = 'added' | 'removed' | 'full';

const NO_ENTRIES: readonly LibraryEntry[] = [];

const watchlistStore = createStore<readonly LibraryEntry[]>({load: () => NO_ENTRIES, serverState: NO_ENTRIES});

function newestFirst(a: LibraryEntry, b: LibraryEntry): number {
  return b.addedAt - a.addedAt;
}

export function useWatchlist<T>(select: (entries: readonly LibraryEntry[]) => T, equals?: (a: T, b: T) => boolean): T {
  return useStore(watchlistStore, select, equals);
}

export function useInWatchlist(key: EntryKey): boolean {
  return useStore(watchlistStore, (entries) => entries.some((entry) => entry.key === key));
}

export function removeFromWatchlist(key: EntryKey): LibraryEntry | null {
  const entry = watchlistStore.get().find((item) => item.key === key) ?? null;
  if (entry !== null) watchlistStore.set((entries) => entries.filter((item) => item.key !== key));
  return entry;
}

export function restoreWatchlistEntry(entry: LibraryEntry): void {
  watchlistStore.set((entries) => [entry, ...entries.filter((item) => item.key !== entry.key)].sort(newestFirst));
}

export function toggleWatchlist(key: EntryKey, snapshot: TitleSnapshot): ToggleResult {
  if (removeFromWatchlist(key) !== null) return 'removed';
  restoreWatchlistEntry({key, snapshot, addedAt: Date.now()});
  return 'added';
}
