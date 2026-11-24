const LEGACY_PROXY_HOST = 'wsrv.nl';

export function artworkUrl(value: unknown): string | undefined {
    if (typeof value !== 'string') return undefined;
    const trimmed = value.trim();
    if (!trimmed) return undefined;
    try {
        const url = new URL(trimmed);
        if (url.protocol === 'https:') return trimmed;
        if (url.protocol !== 'http:') return undefined;
        url.protocol = 'https:';
        return url.href;
    } catch {
        return undefined;
    }
}

export function withoutLegacyProxy<T>(value: T): T {
    if (typeof value !== 'string') return value;
    try {
        const url = new URL(value);
        if (url.hostname !== LEGACY_PROXY_HOST) return value;
        return (artworkUrl(url.searchParams.get('url')) ?? value) as T;
    } catch {
        return value;
    }
}

export function withoutLegacyProxies<T>(values: T): T {
    return Array.isArray(values) ? [...new Set(values.map(withoutLegacyProxy))] as T : values;
}
