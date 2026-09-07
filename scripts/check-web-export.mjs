import {readFileSync, existsSync} from 'node:fs';
import {join} from 'node:path';

const dir = process.argv[2];
if (!dir) {
    console.error('usage: node scripts/check-web-export.mjs <export-dir>');
    process.exit(2);
}

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

for (const [file, expectTitle] of ROUTES) {
    const path = join(dir, file);
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

for (const asset of ['manifest.json', 'robots.txt', 'sitemap.xml', 'og-card.png', '.well-known/assetlinks.json']) {
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
    deletionBodies.push(readFileSync(path, 'utf8'));
}
if (deletionBodies.length === DELETION_PAGES.length && deletionBodies[0] !== deletionBodies[1]) {
    failures.push(
        `${DELETION_PAGES.join(' and ')} have drifted — they serve /delete-account and /delete-account/ and must stay identical`
    );
}

if (existsSync(join(dir, '_sitemap.html'))) {
    failures.push('_sitemap.html: the expo-router dev route leaked into the export');
}

if (failures.length) {
    console.error(`Web export check FAILED (${failures.length}):`);
    for (const f of failures) console.error(`  - ${f}`);
    process.exit(1);
}
console.log(`Web export check passed for ${dir}`);
