const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const {test} = require('node:test');
const brand = require('../../config/brand.json');

const root = path.resolve(__dirname, '../..');
const stamp = import('../../scripts/brand/stamp-public.mjs');

const COLOR_ROLES = [
    'surface', 'surfaceContainerLowest', 'surfaceContainerLow', 'surfaceContainer', 'surfaceContainerHigh',
    'surfaceContainerHighest', 'onSurface', 'onSurfaceVariant', 'outline', 'outlineVariant', 'primary',
    'onPrimary', 'primaryContainer', 'onPrimaryContainer', 'secondaryContainer', 'onSecondaryContainer',
    'error', 'onError', 'errorContainer', 'onErrorContainer', 'inverseSurface', 'inverseOnSurface',
    'inversePrimary', 'ratingStar', 'scrim', 'mediaScrim', 'onMedia', 'focusRing',
];
const ACCENT_ROLES = ['primary', 'onPrimary', 'primaryContainer', 'onPrimaryContainer', 'inversePrimary', 'focusRing'];
const ACCENT_IDS = ['default', 'accent1', 'accent2', 'accent3', 'accent4'];
const HEX = /^#(?:[0-9A-Fa-f]{6}|[0-9A-Fa-f]{8})$/;
const SOURCE_EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.cjs', '.mjs', '.json']);

function sourceFiles(directory) {
    if (!fs.existsSync(directory)) return [];
    return fs.readdirSync(directory, {withFileTypes: true}).flatMap((entry) => {
        const file = path.join(directory, entry.name);
        if (entry.isDirectory()) return sourceFiles(file);
        return SOURCE_EXTENSIONS.has(path.extname(file)) ? [file] : [];
    });
}

test('config/brand.json defines every colour role, accent slot and font face', () => {
    assert.ok(['placeholder', 'final'].includes(brand.status));
    assert.equal(typeof brand.appName, 'string');
    assert.ok(brand.appName.trim().length > 0);
    for (const scheme of ['light', 'dark']) {
        assert.deepEqual(Object.keys(brand.colors[scheme]).sort(), [...COLOR_ROLES].sort(), scheme);
        for (const role of COLOR_ROLES.filter((name) => !['scrim', 'mediaScrim'].includes(name))) {
            assert.match(brand.colors[scheme][role], HEX, `${scheme}.${role}`);
        }
    }
    assert.deepEqual(brand.accents.map((accent) => accent.id), ACCENT_IDS);
    for (const accent of brand.accents) {
        assert.ok(accent.name.trim().length > 0);
        for (const scheme of ['light', 'dark']) {
            assert.deepEqual(Object.keys(accent[scheme]).sort(), [...ACCENT_ROLES].sort(), `${accent.id}.${scheme}`);
            for (const role of ACCENT_ROLES) assert.match(accent[scheme][role], HEX, `${accent.id}.${scheme}.${role}`);
        }
    }
    for (const face of ['display', 'body', 'bodyStrong']) {
        const font = brand.fonts[face];
        assert.ok(fs.statSync(path.resolve(root, font.file)).isFile(), font.file);
        assert.equal(path.basename(font.file, '.ttf'), font.family);
        assert.match(font.web, /^[A-Za-z0-9-]+\.woff2$/);
        assert.ok([400, 500, 600, 700].includes(font.weight));
    }
    assert.match(brand.androidIconBackground, HEX);
});

test('the stamped web files match config/brand.json', async () => {
    const {stampPublic} = await stamp;
    const {stale} = await stampPublic({root, check: true});
    assert.deepEqual(stale, [], 'run yarn brand:stamp');
    const manifest = JSON.parse(fs.readFileSync(path.join(root, 'public/manifest.json'), 'utf8'));
    assert.equal(manifest.name, brand.appName);
    assert.equal(manifest.short_name, brand.appName);
    assert.equal(manifest.background_color, brand.colors.dark.surface);
    assert.equal(manifest.theme_color, brand.colors.dark.surface);
    const css = fs.readFileSync(path.join(root, 'public/brand.css'), 'utf8');
    for (const role of COLOR_ROLES) {
        assert.ok(css.includes(`--c-${role}: ${brand.colors.light[role]};`), role);
        assert.ok(css.includes(`--c-${role}: ${brand.colors.dark[role]};`), role);
    }
});

test('stamping renames app-name spans and the title suffix only on branded pages', async () => {
    const {stampHtml} = await stamp;
    const page = '<title>Privacy Policy · Old</title><p><span class="app-name">Old</span> and <span class="app-name">Old</span></p>';
    assert.equal(stampHtml(page, 'New & Co'),
        '<title>Privacy Policy · New &amp; Co</title><p><span class="app-name">New &amp; Co</span> and <span class="app-name">New &amp; Co</span></p>');
    assert.equal(stampHtml('<title>Terms &middot; Old</title><span class="app-name">Old</span>', 'New'),
        '<title>Terms &middot; New</title><span class="app-name">New</span>');
    const unbranded = '<title>Support · Old</title><p>Old</p>';
    assert.equal(stampHtml(unbranded, 'New'), unbranded);
});

test('release checks require final values, no banned colours and byte-identical icons', async (t) => {
    const {checkRelease} = await stamp;
    const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'yify-brand-'));
    t.after(() => fs.rmSync(temporary, {recursive: true, force: true}));
    for (const directory of ['config', 'src/core', 'icons/assets', 'assets']) fs.mkdirSync(path.join(temporary, directory), {recursive: true});
    fs.writeFileSync(path.join(temporary, 'config/brand.json'), JSON.stringify({status: 'placeholder'}));
    fs.writeFileSync(path.join(temporary, 'src/core/theme.ts'), "export const accent = '#9c452b';\n");
    fs.writeFileSync(path.join(temporary, 'icons/assets/icon.png'), Buffer.from([1, 2, 3]));
    fs.writeFileSync(path.join(temporary, 'assets/icon.png'), Buffer.from([1, 2, 4]));
    const problems = await checkRelease({root: temporary, icons: path.join(temporary, 'icons')});
    assert.equal(problems.length, 3);
    assert.match(problems[0], /status is "placeholder"/);
    assert.match(problems[1], /src\/core\/theme\.ts:1 uses the banned colour #9c452b/);
    assert.match(problems[2], /assets\/icon\.png differs/);
    fs.writeFileSync(path.join(temporary, 'config/brand.json'), JSON.stringify({status: 'final'}));
    fs.writeFileSync(path.join(temporary, 'src/core/theme.ts'), "export const accent = '#9c452b1';\n");
    fs.writeFileSync(path.join(temporary, 'assets/icon.png'), Buffer.from([1, 2, 3]));
    assert.deepEqual(await checkRelease({root: temporary, icons: path.join(temporary, 'icons')}), []);
});

test('the app name appears as a word only in src/core/config', () => {
    const names = [...new Set([brand.appName, 'Yify'])].map((name) => name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
    const word = new RegExp(`\\b(?:${names.join('|')})\\b`);
    const offenders = [...sourceFiles(path.join(root, 'src')), ...sourceFiles(path.join(root, 'app'))]
        .filter((file) => !file.startsWith(path.join(root, 'src/core/config') + path.sep))
        .filter((file) => word.test(fs.readFileSync(file, 'utf8').replace(/\bX-Yify-[A-Za-z0-9-]+/gi, '')))
        .map((file) => path.relative(root, file));
    assert.deepEqual(offenders, [], 'use APP_NAME from src/core/config/app.ts');
});
