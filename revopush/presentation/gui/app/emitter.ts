type Listener = (payload?: any) => void;

export class Emitter {
    #listeners = new Map<string, Set<Listener>>();

    on(event: string, fn: Listener): () => void {
        const set = this.#listeners.get(event) ?? new Set<Listener>();
        set.add(fn);
        this.#listeners.set(event, set);
        return () => set.delete(fn);
    }

    emit(event: string, payload?: any): void {
        const set = this.#listeners.get(event);
        if (set) for (const fn of [...set]) fn(payload);
    }
}
