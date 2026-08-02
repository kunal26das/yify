import type {KeyValueStore} from '@/domain';

export class SessionCache implements KeyValueStore {
    private readonly map = new Map<string, string>();

    getString(key: string): string | undefined {
        return this.map.get(key);
    }

    set(key: string, value: string): void {
        this.map.set(key, value);
    }

    delete(key: string): void {
        this.map.delete(key);
    }
}
