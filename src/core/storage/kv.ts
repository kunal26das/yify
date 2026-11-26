import Storage from 'expo-sqlite/kv-store';

export interface KeyValueStore {
  getString(key: string): string | undefined;
  setString(key: string, value: string): boolean;
  remove(key: string): void;
  keys(): string[];
}

export const kv: KeyValueStore = {
  getString(key) {
    try {
      return Storage.getItemSync(key) ?? undefined;
    } catch {
      return undefined;
    }
  },
  setString(key, value) {
    try {
      Storage.setItemSync(key, value);
      return true;
    } catch {
      return false;
    }
  },
  remove(key) {
    try {
      Storage.removeItemSync(key);
    } catch {
      return;
    }
  },
  keys() {
    try {
      return Storage.getAllKeysSync();
    } catch {
      return [];
    }
  },
};
