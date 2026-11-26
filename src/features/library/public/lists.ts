import type {EntryKey} from '@/core/domain/keys';
import type {TitleSnapshot, UserList} from '@/core/domain/library';
import {createStore, useStore} from '@/core/store/createStore';

export type ListResult = {ok: true; list: UserList} | {ok: false; reason: 'empty' | 'duplicate' | 'max'};

const NO_LISTS: readonly UserList[] = [];

const listsStore = createStore<readonly UserList[]>({load: () => NO_LISTS, serverState: NO_LISTS});

let nextId = 1;

function newestFirst(a: UserList, b: UserList): number {
  return b.updatedAt - a.updatedAt;
}

function selectCount(lists: readonly UserList[]): number {
  return lists.length;
}

function validName(name: string, exceptId: string | null): {ok: true; name: string} | {ok: false; reason: 'empty' | 'duplicate'} {
  const trimmed = name.trim();
  if (trimmed === '') return {ok: false, reason: 'empty'};
  const folded = trimmed.toLowerCase();
  const taken = listsStore.get().some((list) => list.id !== exceptId && list.name.toLowerCase() === folded);
  return taken ? {ok: false, reason: 'duplicate'} : {ok: true, name: trimmed};
}

function replaceList(next: UserList): void {
  listsStore.set((lists) => [next, ...lists.filter((list) => list.id !== next.id)].sort(newestFirst));
}

export function useLists<T>(select: (lists: readonly UserList[]) => T, equals?: (a: T, b: T) => boolean): T {
  return useStore(listsStore, select, equals);
}

export function useList(id: string): UserList | null {
  return useStore(listsStore, (lists) => lists.find((list) => list.id === id) ?? null);
}

export function useCustomListCount(): number {
  return useStore(listsStore, selectCount);
}

export function createList(name: string): ListResult {
  const checked = validName(name, null);
  if (!checked.ok) return checked;
  const now = Date.now();
  const list: UserList = {id: `l${now.toString(36)}${nextId}`, name: checked.name, createdAt: now, updatedAt: now, removedAt: 0, items: {}};
  nextId += 1;
  replaceList(list);
  return {ok: true, list};
}

export function renameList(id: string, name: string): ListResult {
  const current = listsStore.get().find((list) => list.id === id);
  if (current === undefined) return {ok: false, reason: 'empty'};
  const checked = validName(name, id);
  if (!checked.ok) return checked;
  const list: UserList = {...current, name: checked.name, updatedAt: Date.now()};
  replaceList(list);
  return {ok: true, list};
}

export function removeList(id: string): UserList | null {
  const list = listsStore.get().find((item) => item.id === id) ?? null;
  if (list !== null) listsStore.set((lists) => lists.filter((item) => item.id !== id));
  return list;
}

export function restoreList(list: UserList): void {
  replaceList(list);
}

export function setListItem(id: string, key: EntryKey, snapshot: TitleSnapshot, included: boolean): void {
  const current = listsStore.get().find((list) => list.id === id);
  if (current === undefined) return;
  const at = Date.now();
  replaceList({...current, updatedAt: at, items: {...current.items, [key]: {at, value: included, snapshot}}});
}
