import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

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

export async function checkLivePrivacy({cwd = projectRoot, fetch: request = globalThis.fetch, timeoutMs = 10_000} = {}) {
    const source = fs.readFileSync(path.join(cwd, 'public', 'privacy.html'), 'utf8');
    const canonical = source.match(/<link\s+rel=["']canonical["']\s+href=["']([^"']+)["']/i)?.[1];
    const contact = source.match(/href=["'](mailto:[^"']+)["']/i)?.[1];
    if (!canonical || !contact) throw new Error('The privacy source must provide its canonical URL and contact before an Android release.');
    const embedded = httpsUrl(canonical);
    const store = httpsUrl('../privacy.html', embedded);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(new Error('Live privacy check timed out.')), timeoutMs);
    try {
        await Promise.all([embedded, store].map(async (initial) => {
            let url = initial;
            try {
                for (let redirects = 0; redirects <= 3; redirects += 1) {
                    const response = await request(url, {
                        method: 'GET', redirect: 'manual', credentials: 'omit', cache: 'no-store',
                        headers: {Accept: 'text/html'}, signal: controller.signal,
                    });
                    if ([301, 302, 303, 307, 308].includes(response.status)) {
                        await response.body?.cancel();
                        const location = response.headers.get('location');
                        if (!location || redirects === 3) throw new Error('Invalid or excessive redirects.');
                        url = httpsUrl(location, url);
                        continue;
                    }
                    if (!response.ok || !/^text\/html\b/i.test(response.headers.get('content-type') ?? '')) {
                        await response.body?.cancel();
                        throw new Error(`Expected public HTML; received HTTP ${response.status}.`);
                    }
                    const html = (await response.text()).replace(/<(script|style|template)\b[^>]*>[\s\S]*?<\/\1>/gi, '');
                    const heading = html.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/i)?.[1].replace(/<[^>]+>/g, '').trim();
                    const hasContact = [...html.matchAll(/<a\b[^>]*\bhref=["'](mailto:[^"']+)["'][^>]*>/gi)].some((match) => match[1] === contact);
                    if (!/^Privacy\s+Policy$/i.test(heading ?? '') || !hasContact) {
                        throw new Error('The response is missing the privacy policy heading or contact link.');
                    }
                    return;
                }
            } catch (error) {
                throw new Error(`Live privacy check failed for ${initial}: ${error.message} Android production handoff stopped.`);
            }
        }));
    } finally {
        clearTimeout(timeout);
        controller.abort();
    }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
    try {
        await checkLivePrivacy();
        console.log('Live privacy policy links passed.');
    } catch (error) {
        console.error(error.message);
        process.exitCode = 1;
    }
}
