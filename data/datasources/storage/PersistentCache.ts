import {createMMKV} from 'react-native-mmkv';
import type {KeyValueStore} from '@/domain';

export class PersistentCache implements KeyValueStore {
    private readonly mmkv;

    constructor(id: string) {
        this.mmkv = createMMKV({id});
    }

    getString(key: string): string | undefined {
        return this.mmkv.getString(key);
    }

    set(key: string, value: string): void {
        this.mmkv.set(key, value);
    }

    delete(key: string): void {
        this.mmkv.remove(key);
    }
}
