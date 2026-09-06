export const SITE_URL = 'https://yify.expo.app';

export function canonicalUrl(path: string): string {
    if (!path || path === '/') return `${SITE_URL}/`;
    return `${SITE_URL}/${path.replace(/^\/+/, '')}`;
}
