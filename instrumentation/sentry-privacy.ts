import type {Breadcrumb, ErrorEvent} from '@sentry/react-native';

function httpOrigin(value: unknown): string | undefined {
    if (typeof value !== 'string') return undefined;
    try {
        const url = new URL(value);
        return url.protocol === 'https:' || url.protocol === 'http:' ? url.origin : undefined;
    } catch {
        return undefined;
    }
}

export function sanitizeBreadcrumb(breadcrumb: Breadcrumb): Breadcrumb | null {
    if (breadcrumb.category === 'console') return null;
    if (breadcrumb.type !== 'http' && !['http', 'xhr', 'fetch'].includes(breadcrumb.category ?? '')) {
        return breadcrumb;
    }

    const data = breadcrumb.data;
    return {
        ...breadcrumb,
        message: undefined,
        data: {
            url: httpOrigin(data?.url),
            method: data?.method,
            status_code: data?.status_code,
        },
    };
}

export function sanitizeErrorEvent(event: ErrorEvent): ErrorEvent {
    return {
        ...event,
        request: event.request ? {
            url: httpOrigin(event.request.url),
            method: event.request.method,
        } : undefined,
        breadcrumbs: event.breadcrumbs
            ?.map(sanitizeBreadcrumb)
            .filter((breadcrumb): breadcrumb is Breadcrumb => breadcrumb !== null),
    };
}
