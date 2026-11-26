import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const LOOPBACK_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]']);
const REDIRECTS = new Set([301, 302, 303, 307, 308]);
const MAX_REDIRECTS = 3;
const USAGE = 'usage: node scripts/check-live-privacy.mjs [--url <privacy page URL>]';

function option(args, names, fallback) {
    let value = fallback;
    for (let index = 1; index < args.length; index += 1) {
        for (const name of names) {
            if (args[index] === name) value = args[++index] ?? fallback;
            else if (args[index]?.startsWith(`${name}=`)) value = args[index].slice(name.length + 1);
        }
    }
    return value;
}

export function requiresLivePrivacyCheck(args, cwd = projectRoot) {
    const command = args[0] === 'build:submit' ? 'submit' : args[0];
    if (!['build', 'submit'].includes(command) || args.some((arg) => ['--help', '-h', '--dry-run'].includes(arg))) return false;
    if (option(args, ['--platform', '-p']) === 'ios') return false;
    const name = option(args, ['--profile', '-e'], 'production');
    const autoSubmit = option(args, ['--auto-submit-with-profile'], args.some((arg) => ['--auto-submit', '--submit', '-s'].includes(arg)) ? name : undefined);
    if (['production', 'play-production'].includes(name) || autoSubmit === 'play-production') return true;
    const config = JSON.parse(fs.readFileSync(path.join(cwd, 'eas.json'), 'utf8'));
    function profile(section, key, seen = new Set()) {
        if (seen.has(key) || !Object.hasOwn(config[section] ?? {}, key)) throw new Error(`Invalid EAS ${section} profile: ${key}`);
        seen.add(key);
        const value = config[section][key];
        const parent = value.extends ? profile(section, value.extends, seen) : {};
        return {...parent, ...value, android: {...parent.android, ...value.android}};
    }
    const selected = profile(command, name);
    if (command === 'submit') return selected.android?.track === 'production';
    return (selected.environment === 'production' && selected.distribution !== 'internal') ||
        Boolean(autoSubmit && profile('submit', autoSubmit).android?.track === 'production');
}

function httpsUrl(value, base) {
    const url = new URL(value, base);
    if (url.protocol !== 'https:' || url.username || url.password) throw new Error('The public privacy URL and every redirect must use unauthenticated HTTPS.');
    return url.href;
}

function checkedUrl(value, base) {
    const url = new URL(value, base);
    const loopback = url.protocol === 'http:' && LOOPBACK_HOSTS.has(url.hostname);
    if ((url.protocol !== 'https:' && !loopback) || url.username || url.password) {
        throw new Error('The privacy URL and every redirect must use unauthenticated HTTPS (plain HTTP only on localhost).');
    }
    return url.href;
}

function readableHtml(html) {
    return html.replace(/<(script|style|template)\b[^>]*>[\s\S]*?<\/\1>/gi, '');
}

function headingText(html) {
    return html.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/i)?.[1].replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
}

async function fetchHtml(initial, {request, signal, normalize}) {
    let url = initial;
    for (let redirects = 0; redirects <= MAX_REDIRECTS; redirects += 1) {
        const response = await request(url, {
            method: 'GET', redirect: 'manual', credentials: 'omit', cache: 'no-store',
            headers: {Accept: 'text/html'}, signal,
        });
        if (REDIRECTS.has(response.status)) {
            await response.body?.cancel();
            const location = response.headers.get('location');
            if (!location || redirects === MAX_REDIRECTS) throw new Error('Invalid or excessive redirects.');
            url = normalize(location, url);
            continue;
        }
        if (response.status !== 200 || !/^text\/html\b/i.test(response.headers.get('content-type') ?? '')) {
            await response.body?.cancel();
            throw new Error(`Expected public HTML; received HTTP ${response.status}.`);
        }
        return readableHtml(await response.text());
    }
    throw new Error('Invalid or excessive redirects.');
}

async function withTimeout(timeoutMs, run) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(new Error('Live privacy check timed out.')), timeoutMs);
    try {
        return await run(controller.signal);
    } finally {
        clearTimeout(timeout);
        controller.abort();
    }
}

export function publishedPrivacyUrls(source) {
    const canonical = source.match(/<link\s+rel=["']canonical["']\s+href=["']([^"']+)["']/i)?.[1];
    const contact = source.match(/href=["'](mailto:[^"']+)["']/i)?.[1];
    if (!canonical || !contact) throw new Error('The privacy source must provide its canonical URL and contact before an Android release.');
    const page = httpsUrl(canonical);
    return {urls: [...new Set([page, httpsUrl('/privacy.html', page), httpsUrl('/privacy/', page)])], contact};
}

export async function checkLivePrivacy({cwd = projectRoot, fetch: request = globalThis.fetch, timeoutMs = 10_000} = {}) {
    const {urls, contact} = publishedPrivacyUrls(fs.readFileSync(path.join(cwd, 'public', 'privacy.html'), 'utf8'));
    await withTimeout(timeoutMs, (signal) => Promise.all(urls.map(async (initial) => {
        try {
            const html = await fetchHtml(initial, {request, signal, normalize: httpsUrl});
            const hasContact = [...html.matchAll(/<a\b[^>]*\bhref=["'](mailto:[^"']+)["'][^>]*>/gi)].some((match) => match[1] === contact);
            if (!/^Privacy\s+Policy$/i.test(headingText(html) ?? '') || !hasContact) {
                throw new Error('The response is missing the privacy policy heading or contact link.');
            }
        } catch (error) {
            throw new Error(`Live privacy check failed for ${initial}: ${error.message} Android production handoff stopped.`);
        }
    })));
    return urls;
}

export async function checkPrivacyUrl(url, {fetch: request = globalThis.fetch, timeoutMs = 10_000} = {}) {
    let initial;
    try {
        initial = checkedUrl(url);
    } catch (error) {
        throw new Error(`Privacy URL check failed for ${url}: ${error.message}`);
    }
    await withTimeout(timeoutMs, async (signal) => {
        try {
            const html = await fetchHtml(initial, {request, signal, normalize: checkedUrl});
            if (!/privacy/i.test(headingText(html) ?? '')) throw new Error('The page has no heading that contains "Privacy".');
        } catch (error) {
            throw new Error(`Privacy URL check failed for ${initial}: ${error.message}`);
        }
    });
    return initial;
}

export function parseArguments(args) {
    if (args.length === 0) return {mode: 'published'};
    if (args.length === 2 && args[0] === '--url' && args[1]) return {mode: 'url', url: args[1]};
    if (args.length === 1 && args[0].startsWith('--url=') && args[0].length > 6) return {mode: 'url', url: args[0].slice(6)};
    throw new Error(USAGE);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
    try {
        const options = parseArguments(process.argv.slice(2));
        if (options.mode === 'url') {
            console.log(`Privacy page passed: ${await checkPrivacyUrl(options.url)}`);
        } else {
            const urls = await checkLivePrivacy();
            console.log(`Live privacy policy links passed: ${urls.join(', ')}`);
        }
    } catch (error) {
        console.error(error.message);
        process.exitCode = 1;
    }
}
