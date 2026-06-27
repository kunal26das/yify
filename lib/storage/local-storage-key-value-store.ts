import type {KeyValueStore} from './key-value-store';
import {InMemoryKeyValueStore} from './key-value-store';

/**
 * `localStorage`-backed {@link KeyValueStore} for the web target. Keys are
 * namespaced by `id` to mirror the per-id isolation of the native MMKV store.
 * Falls back to an in-memory store when `localStorage` is unavailable (e.g.
 * during static rendering in Node, or private-mode quota errors), so callers
 * never need to guard for the environment.
 */
export function createLocalStorageStore(id: string): KeyValueStore {
    if (typeof window === 'undefined' || !window.localStorage) {
        return new InMemoryKeyValueStore();
    }
    const prefix = `${id}:`;
    const ls = window.localStorage;
    return {
        getString: (key) => ls.getItem(prefix + key) ?? undefined,
        set: (key, value) => ls.setItem(prefix + key, value),
        delete: (key) => ls.removeItem(prefix + key),
    };
}
