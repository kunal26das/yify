import {createLocalStorageStore} from './local-storage-key-value-store';
import type {KeyValueStore} from './key-value-store';

export function createKeyValueStore(id: string): KeyValueStore {
    return createLocalStorageStore(id);
}
