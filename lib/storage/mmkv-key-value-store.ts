import {createMMKV} from 'react-native-mmkv';
import type {KeyValueStore} from './key-value-store';

export function createMmkvStore(id: string): KeyValueStore {
    const mmkv = createMMKV({id});
    return {
        getString: (key) => mmkv.getString(key),
        set: (key, value) => mmkv.set(key, value),
        delete: (key) => {
            mmkv.remove(key);
        },
    };
}
