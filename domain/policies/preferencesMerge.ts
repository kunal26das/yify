export type SectionGuards<T> = {
    [K in keyof T]-?: (value: unknown) => boolean;
};

export function readSection<T>(raw: unknown, guards: SectionGuards<T>): Partial<T> | undefined {
    if (raw == null || typeof raw !== 'object' || Array.isArray(raw)) return undefined;
    const source = raw as Record<string, unknown>;
    const checks = guards as Record<string, (value: unknown) => boolean>;
    const next: Record<string, unknown> = {};
    let seen = false;
    Object.keys(checks).forEach((key) => {
        const value = source[key];
        if (value === undefined || !checks[key](value)) return;
        next[key] = value;
        seen = true;
    });
    return seen ? (next as Partial<T>) : undefined;
}

export function mergeSection<T>(current: T, incoming: Partial<T> | undefined): T {
    if (incoming == null) return current;
    const source = incoming as Record<string, unknown>;
    const next = {...current} as Record<string, unknown>;
    Object.keys(source).forEach((key) => {
        if (source[key] !== undefined) next[key] = source[key];
    });
    return next as T;
}
