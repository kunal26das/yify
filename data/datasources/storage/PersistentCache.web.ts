import type {KeyValueStore} from '@/domain';

export class PersistentCache implements KeyValueStore {
    private readonly prefix: string;
    private readonly storage: Storage | null;

    constructor(id: string) {
        this.prefix = `${id}:`;
        this.storage =
            typeof window !== 'undefined' && window.localStorage ? window.localStorage : null;
    }

    getString(key: string): string | undefined {
        return this.storage?.getItem(this.prefix + key) ?? undefined;
    }

    set(key: string, value: string): void {
        this.storage?.setItem(this.prefix + key, value);
    }

    delete(key: string): void {
        this.storage?.removeItem(this.prefix + key);
    }
}
