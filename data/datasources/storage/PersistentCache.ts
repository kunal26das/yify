import Storage from 'expo-sqlite/kv-store';
import type {KeyValueStore} from '@/domain';

export class PersistentCache implements KeyValueStore {
    private readonly prefix: string;

    constructor(id: string) {
        this.prefix = `${id}:`;
    }

    getString(key: string): string | undefined {
        return Storage.getItemSync(this.prefix + key) ?? undefined;
    }

    set(key: string, value: string): void {
        Storage.setItemSync(this.prefix + key, value);
    }

    delete(key: string): void {
        Storage.removeItemSync(this.prefix + key);
    }
}
