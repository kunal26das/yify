export interface Observable<T> {
    get(): T;

    set(next: Partial<T>): void;

    subscribe(listener: () => void): () => void;
}

export function createObservable<T extends object>(initial: T): Observable<T> {
    let state = initial;
    const listeners = new Set<() => void>();

    return {
        get(): T {
            return state;
        },
        set(next: Partial<T>): void {
            state = {...state, ...next};
            listeners.forEach((listener) => listener());
        },
        subscribe(listener: () => void): () => void {
            listeners.add(listener);
            return () => {
                listeners.delete(listener);
            };
        },
    };
}
