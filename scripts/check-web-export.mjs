import {readFileSync, existsSync, readdirSync, statSync} from 'node:fs';
import {join, relative, resolve, isAbsolute} from 'node:path';

const [exportDirectory, ...flags] = process.argv.slice(2);
if (!exportDirectory || flags.length > 1 || flags.some((flag) => !['--server', '--static'].includes(flag))) {
    console.error('usage: node scripts/check-web-export.mjs <export-dir> [--server|--static]');
    process.exit(2);
}
const serverOutput = flags[0] === '--server' || (!flags.length && existsSync(join(exportDirectory, 'client')));
const dir = serverOutput ? join(exportDirectory, 'client') : exportDirectory;
const htmlDirectory = serverOutput ? join(exportDirectory, 'server') : dir;

const MIN_BODY_BYTES = 4000;
const ROUTES = [
    ['index.html', 'Yify'],
    ['movies.html', 'Browse Movies'],
    ['shows.html', 'Shows'],
    ['watchlist.html', 'Watchlist'],
    ['history.html', 'History'],
    ['preferences.html', 'Preferences'],
];

const failures = [];

if (serverOutput) {
    const serverDirectory = resolve(exportDirectory, 'server');
    try {
        const manifest = JSON.parse(readFileSync(join(serverDirectory, '_expo', 'routes.json'), 'utf8'));
        const route = Array.isArray(manifest?.apiRoutes)
            ? manifest.apiRoutes.find((entry) => entry?.page === '/api/catalog/[operation]')
            : undefined;
        if (typeof route?.file !== 'string') throw new Error('catalog route missing from server manifest');
        const routeFile = resolve(serverDirectory, route.file);
        const routePath = relative(serverDirectory, routeFile);
        if (isAbsolute(route.file) || routePath.startsWith('..') || !routePath || !statSync(routeFile).isFile()) {
            throw new Error('catalog route bundle is missing or outside the server directory');
        }
    } catch (error) {
        failures.push(`server catalog API: ${error.message}`);
    }
} else {
    for (const serverPath of ['server', 'client', '_expo/functions', '_expo/routes.json']) {
        if (existsSync(join(dir, serverPath))) failures.push(`${serverPath}: server output must not be published as a static site`);
    }
}

function clientFiles(directory) {
    if (!existsSync(directory)) return [];
    return readdirSync(directory, {withFileTypes: true}).flatMap((entry) => {
        const file = join(directory, entry.name);
        if (entry.isDirectory()) return clientFiles(file);
        return entry.isFile() && /\.js$/i.test(entry.name) ? [file] : [];
    });
}

const bundles = clientFiles(dir);
if (!bundles.length) failures.push('client JavaScript bundles: missing from the export');
for (const bundle of bundles) {
    const source = readFileSync(bundle, 'utf8');
    for (const marker of ['movies-api.accel.li', 'eztvx.to', 'list_movies.json', 'get-torrents', 'magnet:?', 'xt=urn:btih']) {
        if (source.includes(marker)) failures.push(`${relative(dir, bundle)}: forbidden browser catalog data marker ${marker}`);
    }
}

for (const [file, expectTitle] of ROUTES) {
    const path = join(htmlDirectory, file);
    if (!existsSync(path)) {
        failures.push(`${file}: missing from the export`);
        continue;
    }
    const html = readFileSync(path, 'utf8');
    const body = html.match(/<body>([\s\S]*)<\/body>/)?.[1] ?? '';
    if (body.length < MIN_BODY_BYTES) {
        failures.push(
            `${file}: prerendered body is ${body.length}B (< ${MIN_BODY_BYTES}B) — static rendering produced an empty shell`
        );
    }
    const firstTitle = html.match(/<title[^>]*>([\s\S]*?)<\/title>/)?.[1]?.trim() ?? '';
    if (!firstTitle) {
        failures.push(`${file}: first <title> is empty — it shadows the document title`);
    } else if (!firstTitle.includes(expectTitle)) {
        failures.push(`${file}: first <title> is "${firstTitle}", expected it to contain "${expectTitle}"`);
    }
    if (!html.includes('@font-face')) {
        failures.push(`${file}: no @font-face rules inlined — fonts will flash`);
    }
}

for (const asset of ['manifest.json', 'robots.txt', 'sitemap.xml', 'og-card.png', '.well-known/assetlinks.json', 'legal.css']) {
    if (!existsSync(join(dir, asset))) failures.push(`${asset}: missing from the export`);
}

const DELETION_PAGES = ['delete-account.html', join('delete-account', 'index.html')];
const deletionBodies = [];
for (const page of DELETION_PAGES) {
    const path = join(dir, page);
    if (!existsSync(path)) {
        failures.push(`${page}: missing — Play requires the account deletion URL to resolve`);
        continue;
    }
    deletionBodies.push(readFileSync(path, 'utf8').match(/<body>([\s\S]*)<\/body>/)?.[1] ?? '');
}
if (deletionBodies.length === DELETION_PAGES.length && deletionBodies[0] !== deletionBodies[1]) {
    failures.push(
        `${DELETION_PAGES.join(' and ')} have drifted — their account-deletion content must stay identical`
    );
}

for (const [name, title] of [['privacy', 'Privacy Policy'], ['terms', 'Terms &amp; Conditions']]) {
    const pages = [`${name}/index.html`, `${name}.html`];
    const normalizedPages = [];
    for (const page of pages) {
        const path = join(dir, page);
        if (!existsSync(path)) {
            failures.push(`${page}: missing legal page`);
            continue;
        }
        const html = readFileSync(path, 'utf8');
        if (!html.includes(`<h1>${title}</h1>`) || !html.includes('mailto:kunal26das@gmail.com')) {
            failures.push(`${page}: legal content or contact information is missing`);
        }
        if (/<script\b/i.test(html)) failures.push(`${page}: legal pages must remain readable without app scripts`);
        normalizedPages.push(html.replace(/href="(\.\.?\/[^"\r\n]*)"/g, (_attribute, href) =>
            `href="${new URL(href, `https://legal.yify.invalid/yify/${page}`).href}"`));
    }
    if (normalizedPages.length === pages.length && normalizedPages[0] !== normalizedPages[1]) {
        failures.push(`${pages.join(' and ')} have drifted — their legal content and resolved links must stay identical`);
    }
}

if ([dir, htmlDirectory].some((directory) => existsSync(join(directory, '_sitemap.html')))) {
    failures.push('_sitemap.html: the expo-router dev route leaked into the export');
}

if (failures.length) {
    console.error(`Web export check FAILED (${failures.length}):`);
    for (const f of failures) console.error(`  - ${f}`);
    process.exit(1);
}
console.log(`Web export check passed for ${exportDirectory}`);
