import type {KeyValueStore} from './kv';
import {KEY_PREFIXES} from './keys';

export type {KeyValueStore};

function localStore(): Storage | null {
  try {
    return typeof window === 'undefined' ? null : window.localStorage ?? null;
  } catch {
    return null;
  }
}

function storedKeys(storage: Storage): string[] {
  const keys: string[] = [];
  for (let index = 0; index < storage.length; index += 1) {
    const key = storage.key(index);
    if (key !== null) keys.push(key);
  }
  return keys;
}

function trySet(storage: Storage, key: string, value: string): boolean {
  try {
    storage.setItem(key, value);
    return true;
  } catch {
    return false;
  }
}

function evictCaches(storage: Storage): void {
  try {
    for (const key of storedKeys(storage)) {
      if (key.startsWith(KEY_PREFIXES.cache)) storage.removeItem(key);
    }
  } catch {
    return;
  }
}

export const kv: KeyValueStore = {
  getString(key) {
    const storage = localStore();
    if (!storage) return undefined;
    try {
      return storage.getItem(key) ?? undefined;
    } catch {
      return undefined;
    }
  },
  setString(key, value) {
    const storage = localStore();
    if (!storage) return false;
    if (trySet(storage, key, value)) return true;
    evictCaches(storage);
    return trySet(storage, key, value);
  },
  remove(key) {
    const storage = localStore();
    if (!storage) return;
    try {
      storage.removeItem(key);
    } catch {
      return;
    }
  },
  keys() {
    const storage = localStore();
    if (!storage) return [];
    try {
      return storedKeys(storage);
    } catch {
      return [];
    }
  },
};
