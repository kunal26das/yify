import type {EntryKey} from '@/core/domain/keys';
import type {DiaryEntry, HalfStars, TitleSnapshot} from '@/core/domain/library';
import {createStore, useStore} from '@/core/store/createStore';

export interface LogWatchInput {
  key: EntryKey;
  snapshot: TitleSnapshot;
  watchedOn: string | null;
  rating: HalfStars | null;
  note: string;
  rewatch: boolean;
}

export type DiaryPatch = Partial<Pick<DiaryEntry, 'watchedOn' | 'rating' | 'note' | 'rewatch'>>;

interface WatchedSummary {
  watched: boolean;
  latest: DiaryEntry | null;
  count: number;
}

const NO_ENTRIES: readonly DiaryEntry[] = [];

const diaryStore = createStore<readonly DiaryEntry[]>({load: () => NO_ENTRIES, serverState: NO_ENTRIES});

let nextId = 1;

function newestFirst(a: DiaryEntry, b: DiaryEntry): number {
  return b.createdAt - a.createdAt;
}

function sameSummary(a: WatchedSummary, b: WatchedSummary): boolean {
  return a.watched === b.watched && a.latest === b.latest && a.count === b.count;
}

export function useDiary<T>(select: (entries: readonly DiaryEntry[]) => T, equals?: (a: T, b: T) => boolean): T {
  return useStore(diaryStore, select, equals);
}

export function useWatched(key: EntryKey): {watched: boolean; latest: DiaryEntry | null; count: number} {
  return useStore(diaryStore, (entries) => {
    const matching = entries.filter((entry) => entry.key === key);
    return {watched: matching.length > 0, latest: matching[0] ?? null, count: matching.length};
  }, sameSummary);
}

export function restoreEntry(entry: DiaryEntry): void {
  diaryStore.set((entries) => [entry, ...entries.filter((item) => item.id !== entry.id)].sort(newestFirst));
}

export function logWatch(input: LogWatchInput): DiaryEntry | 'full' {
  const now = Date.now();
  const entry: DiaryEntry = {...input, id: `d${now.toString(36)}${nextId}`, createdAt: now, updatedAt: now, deletedAt: 0};
  nextId += 1;
  restoreEntry(entry);
  return entry;
}

export function updateEntry(id: string, patch: DiaryPatch): DiaryEntry | null {
  const current = diaryStore.get().find((entry) => entry.id === id);
  if (current === undefined) return null;
  const next: DiaryEntry = {...current, ...patch, updatedAt: Date.now()};
  diaryStore.set((entries) => entries.map((entry) => (entry.id === id ? next : entry)));
  return next;
}

export function removeEntry(id: string): DiaryEntry | null {
  const entry = diaryStore.get().find((item) => item.id === id) ?? null;
  if (entry !== null) diaryStore.set((entries) => entries.filter((item) => item.id !== id));
  return entry;
}
