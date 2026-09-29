import {pathToFileURL} from 'node:url';

export function isPreviewRequestAllowed(requestUrl, previewUrl, assetOrigins = []) {
    try {
        const request = new URL(requestUrl);
        if (!['http:', 'https:'].includes(request.protocol) || request.username || request.password) return false;
        return request.origin === new URL(previewUrl).origin || assetOrigins.includes(request.origin);
    } catch {
        return false;
    }
}

export async function checkWebPreview(previewUrl, {timeoutMs = 30_000} = {}) {
    const base = new URL(previewUrl);
    if (!['http:', 'https:'].includes(base.protocol) || base.username || base.password || base.search || base.hash) {
        throw new Error('Preview URL must be an HTTP page URL without credentials, query, or fragment.');
    }
    if (!base.pathname.endsWith('/')) base.pathname += '/';
    const checks = [];
    async function response(url, contentType) {
        let result;
        try {
            result = await fetch(url, {credentials: 'omit', redirect: 'error', signal: AbortSignal.timeout(timeoutMs)});
        } catch {
            throw new Error(`${url.pathname}: preview request failed or timed out`);
        }
        if (result.status !== 200) throw new Error(`${url.pathname}: expected HTTP 200, received ${result.status}`);
        if (!result.headers.get('content-type')?.toLowerCase().includes(contentType)) {
            throw new Error(`${url.pathname}: expected ${contentType}; a static fallback is not a catalog API`);
        }
        return result;
    }
    for (const [route, title] of [['', 'Yify'], ['movies', 'Browse Movies'], ['shows', 'Shows']]) {
        const url = new URL(route, base);
        const result = await response(url, 'text/html');
        const html = await result.text();
        if (!html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]?.includes(title)) {
            throw new Error(`${url.pathname}: missing expected page title ${title}`);
        }
        checks.push({path: url.pathname, status: result.status});
    }
    for (const operation of ['movies', 'shows']) {
        const url = new URL(`/api/catalog/${operation}?page=1&limit=1&v=2`, base);
        const result = await response(url, 'application/json');
        let body;
        try {
            body = await result.json();
        } catch {
            throw new Error(`${url.pathname}: invalid catalog JSON`);
        }
        if (!Array.isArray(body?.[operation]) || !Number.isInteger(body.pageNumber) || body.pageNumber < 1 ||
            typeof body.hasMore !== 'boolean' || (operation === 'movies' &&
                (!Number.isInteger(body.movieCount) || body.movieCount < 0))) {
            throw new Error(`${url.pathname}: invalid ${operation} catalog response shape`);
        }
        checks.push({path: url.pathname, status: result.status, count: body[operation].length});
    }
    return {baseUrl: base.href, checks};
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
    if (process.argv.length !== 3) {
        console.error('usage: node scripts/check-web-preview.mjs <preview-page-url>');
        process.exitCode = 2;
    } else {
        try {
            console.log(JSON.stringify(await checkWebPreview(process.argv[2]), null, 2));
        } catch (error) {
            console.error(`Preview is not ready: ${error.message}. Serve a Hosting export with Expo serve or configure same-origin catalog fixtures before browser navigation.`);
            process.exitCode = 1;
        }
    }
}
