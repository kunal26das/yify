import type {EntryKey, TitleKey} from '@/core/domain/keys';
import type {RecentEntry, RecentState, TitleSnapshot} from '@/core/domain/library';
import {createStore, useStore} from '@/core/store/createStore';

type KeyedRecent = RecentEntry & {key: EntryKey};

const EMPTY_RECENT: RecentState = {entries: {}, removed: {}, clearedAt: 0};

const recentStore = createStore<RecentState>({load: () => EMPTY_RECENT, serverState: EMPTY_RECENT});

let ordered: {state: RecentState; entries: readonly KeyedRecent[]} | null = null;

function entriesOf(state: RecentState): readonly KeyedRecent[] {
  if (ordered !== null && ordered.state === state) return ordered.entries;
  const entries: KeyedRecent[] = [];
  for (const [key, entry] of Object.entries(state.entries)) {
    if (entry !== undefined) entries.push({...entry, key: key as EntryKey});
  }
  entries.sort((a, b) => b.viewedAt - a.viewedAt);
  ordered = {state, entries};
  return entries;
}

function withEntry(state: RecentState, key: EntryKey, entry: RecentEntry | undefined): RecentState {
  const entries = {...state.entries};
  if (entry === undefined) delete entries[key];
  else entries[key] = entry;
  return {...state, entries};
}

export function useRecent<T>(select: (entries: readonly (RecentEntry & {key: EntryKey})[]) => T, equals?: (a: T, b: T) => boolean): T {
  return useStore(recentStore, (state) => select(entriesOf(state)), equals);
}

export function recordView(key: TitleKey, snapshot: TitleSnapshot): void {
  recentStore.set((state) => withEntry(state, key, {viewedAt: Date.now(), snapshot}));
}

export function removeRecent(key: EntryKey): RecentEntry | null {
  const entry = recentStore.get().entries[key] ?? null;
  if (entry !== null) recentStore.set((state) => withEntry(state, key, undefined));
  return entry;
}

export function restoreRecent(key: EntryKey, entry: RecentEntry): void {
  recentStore.set((state) => withEntry(state, key, entry));
}

export function clearRecent(): RecentState {
  const previous = recentStore.get();
  recentStore.set(() => ({entries: {}, removed: {}, clearedAt: Date.now()}));
  return previous;
}

export function restoreRecentState(state: RecentState): void {
  recentStore.set(() => state);
}
