import type {KeyValueStore} from './key-value-store';
import {InMemoryKeyValueStore} from './key-value-store';

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
