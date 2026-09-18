export async function availabilityPilotAccess(token: string): Promise<boolean> {
    const location = typeof window === 'undefined' ? undefined : window.location;
    const preview = location && ((location.protocol === 'https:' && location.hostname.endsWith('.expo.app')) ||
        ['localhost', '127.0.0.1', '[::1]'].includes(location.hostname));
    const origin = preview ? location.origin : 'https://yify.expo.app';
    const url = new URL('/api/availability-alerts/status', origin);
    if (url.protocol !== 'https:' && !['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)) return false;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 20_000);
    try {
        const response = await fetch(url.href, {signal: controller.signal, cache: 'no-store', redirect: 'error', credentials: 'omit',
            headers: {Accept: 'application/json', Authorization: `Bearer ${token}`}});
        if ([401, 403, 404].includes(response.status)) return false;
        if (!response.ok) throw new Error('Availability alerts are unavailable.');
        const body = await response.json();
        return body?.enabled === true;
    } finally {clearTimeout(timeout);}
}
