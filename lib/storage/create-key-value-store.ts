import {createMmkvStore} from './mmkv-key-value-store';
import type {KeyValueStore} from './key-value-store';

export function createKeyValueStore(id: string): KeyValueStore {
    return createMmkvStore(id);
}
