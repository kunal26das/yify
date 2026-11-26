import type {EntryKey} from './keys';

export interface TitleSnapshot {
  title: string;
  year: number | null;
  posterPath: string | null;
  slug: string;
}

export interface WatchlistEntry {
  addedAt: number;
  snapshot: TitleSnapshot;
}

export interface WatchlistState {
  entries: Partial<Record<EntryKey, WatchlistEntry>>;
  removed: Partial<Record<EntryKey, number>>;
}

export interface LibraryEntry extends WatchlistEntry {
  key: EntryKey;
}

export type HalfStars = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10;

export interface DiaryEntry {
  id: string;
  key: EntryKey;
  snapshot: TitleSnapshot;
  watchedOn: string | null;
  rating: HalfStars | null;
  note: string;
  rewatch: boolean;
  createdAt: number;
  updatedAt: number;
  deletedAt: number;
}

export interface DiaryState {
  entries: Record<string, DiaryEntry>;
  clearedAt: number;
}

export interface ListItem {
  at: number;
  value: boolean;
  snapshot: TitleSnapshot;
}

export interface UserList {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
  removedAt: number;
  items: Partial<Record<EntryKey, ListItem>>;
}

export interface ListsState {
  lists: Record<string, UserList>;
  clearedAt: number;
}

export interface RecentEntry {
  viewedAt: number;
  snapshot: TitleSnapshot;
}

export interface RecentState {
  entries: Partial<Record<EntryKey, RecentEntry>>;
  removed: Partial<Record<EntryKey, number>>;
  clearedAt: number;
}

export const LIMITS = {
  watchlist: 2000,
  diary: 2500,
  listsMax: 100,
  listRecords: 200,
  listItemsTotal: 2000,
  listName: 60,
  recent: 500,
  note: 1000,
  recentSearches: 10,
  tombstoneHorizonMs: 90 * 24 * 60 * 60 * 1000,
} as const;
