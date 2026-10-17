export type WebRobots = 'index,follow' | 'noindex,follow' | 'noindex,nofollow';

const PAGE_TITLES: Record<string, string> = {
    '/': 'Yify — Discover Movies',
    '/movies': 'Browse Movies — Yify',
    '/shows': 'Shows — Yify',
    '/preferences': 'Preferences — Yify',
    '/watchlist': 'Watchlist — Yify',
    '/history': 'History — Yify',
    '/journal': 'Journal — Yify',
    '/anime': 'Anime — Yify',
    '/upgrade': 'Plus options — Yify',
};

const UTILITY_PATHS = new Set(['/preferences', '/watchlist', '/history', '/journal', '/upgrade']);

export function getWebPageMeta(pathname: string, baseUrl = ''): {
    pathname: string;
    title: string;
    robots: WebRobots;
} {
    const basePath = `/${baseUrl.replace(/^\/+|\/+$/g, '')}`;
    let path = pathname.startsWith('/') ? pathname : `/${pathname}`;
    if (basePath !== '/' && (path === basePath || path.startsWith(`${basePath}/`))) {
        path = path.slice(basePath.length) || '/';
    }
    path = path.replace(/\/+$/, '') || '/';

    return {
        pathname: path,
        title: PAGE_TITLES[path] ?? 'Yify — Movie Discovery',
        robots: path === '/anime' ? 'noindex,nofollow'
            : UTILITY_PATHS.has(path) ? 'noindex,follow' : 'index,follow',
    };
}
