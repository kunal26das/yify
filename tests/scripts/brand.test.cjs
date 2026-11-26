const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const {test} = require('node:test');
const brand = require('../../config/brand.json');
const {encodeIco, encodePng, solidPng} = require('../helpers/png.cjs');

const root = path.resolve(__dirname, '../..');
const stamp = import('../../scripts/brand/stamp-public.mjs');
const raster = import('../../scripts/brand/raster.mjs');

const COLOR_ROLES = [
    'surface', 'surfaceContainerLowest', 'surfaceContainerLow', 'surfaceContainer', 'surfaceContainerHigh',
    'surfaceContainerHighest', 'onSurface', 'onSurfaceVariant', 'outline', 'outlineVariant', 'primary',
    'onPrimary', 'primaryContainer', 'onPrimaryContainer', 'secondaryContainer', 'onSecondaryContainer',
    'error', 'onError', 'errorContainer', 'onErrorContainer', 'inverseSurface', 'inverseOnSurface',
    'inversePrimary', 'ratingStar', 'scrim', 'mediaScrim', 'onMedia', 'focusRing',
];
const ACCENT_ROLES = ['primary', 'onPrimary', 'primaryContainer', 'onPrimaryContainer', 'inversePrimary', 'focusRing'];
const ACCENT_IDS = ['default', 'accent1', 'accent2', 'accent3'];
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
    const union = fs.readFileSync(path.join(root, 'src/core/domain/preferences.ts'), 'utf8').match(/export type Accent = ([^;]+);/)[1];
    assert.deepEqual(union.split('|').map((member) => member.trim().replace(/'/g, '')), ACCENT_IDS);
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
        assert.ok([400, 500, 600, 700, 800].includes(font.weight));
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
    fs.writeFileSync(path.join(temporary, 'icons/assets/icon.png'), solidPng(4, 4, [200, 240, 60, 255]));
    fs.writeFileSync(path.join(temporary, 'assets/icon.png'), solidPng(4, 4, [200, 240, 61, 255]));
    const problems = await checkRelease({root: temporary, icons: path.join(temporary, 'icons')});
    assert.equal(problems.length, 3);
    assert.match(problems[0], /status is "placeholder"/);
    assert.match(problems[1], /src\/core\/theme\.ts:1 uses the banned colour #9c452b/);
    assert.match(problems[2], /assets\/icon\.png differs/);
    fs.writeFileSync(path.join(temporary, 'config/brand.json'), JSON.stringify({status: 'final'}));
    fs.writeFileSync(path.join(temporary, 'src/core/theme.ts'), "export const accent = '#9c452b1';\n");
    fs.copyFileSync(path.join(temporary, 'icons/assets/icon.png'), path.join(temporary, 'assets/icon.png'));
    assert.deepEqual(await checkRelease({root: temporary, icons: path.join(temporary, 'icons')}), []);
});

test('the icon comparison fails when the mirror is missing or has no icons', async (t) => {
    const {compareIcons} = await stamp;
    const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'yify-brand-'));
    t.after(() => fs.rmSync(temporary, {recursive: true, force: true}));
    const mirror = path.join(temporary, 'mirror');
    assert.deepEqual(await compareIcons(mirror, temporary), [`${mirror} is not a directory; --icons takes the identity's icon mirror laid out by repository path.`]);
    fs.mkdirSync(path.join(mirror, 'assets'), {recursive: true});
    fs.writeFileSync(path.join(mirror, '.DS_Store'), 'finder');
    assert.deepEqual(await compareIcons(mirror, temporary), [`${mirror} has no icon files to compare.`]);
    fs.writeFileSync(path.join(mirror, 'assets/icon.png'), solidPng(2, 2, [200, 240, 60, 255]));
    assert.deepEqual(await compareIcons(mirror, temporary), ['assets/icon.png is missing']);
    fs.mkdirSync(path.join(temporary, 'assets'));
    fs.copyFileSync(path.join(mirror, 'assets/icon.png'), path.join(temporary, 'assets/icon.png'));
    assert.deepEqual(await compareIcons(mirror, temporary), []);
});

test('release checks flag banned colours in PNG and ICO images under public and assets', async (t) => {
    const {checkRelease} = await stamp;
    const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'yify-brand-'));
    t.after(() => fs.rmSync(temporary, {recursive: true, force: true}));
    for (const directory of ['config', 'public/icons', 'assets/images', 'store-artifacts']) fs.mkdirSync(path.join(temporary, directory), {recursive: true});
    const write = (file, data) => fs.writeFileSync(path.join(temporary, file), data);
    write('config/brand.json', JSON.stringify({status: 'final'}));
    write('public/og-card.png', solidPng(12, 6, [0xd9, 0x77, 0x57, 255]));
    write('public/icons/near.png', solidPng(4, 4, [0x9c + 8, 0x45 - 8, 0x2b + 8, 255]));
    write('public/icons/far.png', solidPng(4, 4, [0x9c + 9, 0x45, 0x2b, 255]));
    write('public/favicon.ico', encodeIco([
        {size: 16, data: solidPng(16, 16, [11, 13, 19, 255])},
        {size: 32, data: solidPng(32, 32, [0xf3, 0xf0, 0xe9, 255])},
    ]));
    write('public/photo.jpg', Buffer.from('jpeg'));
    write('public/broken.png', Buffer.from('nope'));
    write('assets/images/splash.png', encodePng({width: 4, height: 2, samples: (x) => (x % 2 ? [0xf3, 0xf0, 0xe9, 255] : [245, 246, 249, 255])}));
    write('assets/images/sparse.png', encodePng({width: 101, height: 1, samples: (x) => (x ? [11, 13, 19, 255] : [0xd9, 0x77, 0x57, 255])}));
    write('assets/images/hidden.png', solidPng(4, 4, [0xd9, 0x77, 0x57, 0]));
    write('store-artifacts/promo.png', solidPng(4, 4, [0xd9, 0x77, 0x57, 255]));
    assert.deepEqual(await checkRelease({root: temporary}), [
        'public/broken.png cannot be checked for banned colours: not a PNG image.',
        'public/favicon.ico (32x32 layer): 100.0% of its opaque pixels are within 8 of a banned colour, mostly #F3F0E9.',
        'public/icons/near.png: 100.0% of its opaque pixels are within 8 of a banned colour, mostly #9C452B.',
        'public/og-card.png: 100.0% of its opaque pixels are within 8 of a banned colour, mostly #D97757.',
        'public/photo.jpg cannot be checked for banned colours: check:release reads PNG and ICO images only; save it as PNG.',
        'assets/images/splash.png: 50.0% of its opaque pixels are within 8 of a banned colour, mostly #F3F0E9.',
    ]);
});

test('the PNG decoder reads every row filter, bit depth, colour type, transparency and Adam7 interlacing', async () => {
    const {decodeIco, decodePng} = await raster;
    const width = 13;
    const height = 11;
    const value = (x, y, channel) => (x * 31 + y * 17 + channel * 71) % 256;
    const words = (values) => values.flatMap((word) => [word >> 8, word & 255]);
    const keyed = (x, y) => [value(x, y, 0) * 256 + 1, value(x, y, 1) * 256, (x + y) % 2 ? 7 : 9];
    const opaqueUnlessKey = (x, y) => (keyed(x, y).join() === keyed(0, 0).join() ? 0 : 255);
    const palette = [[10, 20, 30], [40, 50, 60], [70, 80, 90], [200, 210, 220]];
    const index = (x, y) => (x + 2 * y) % 4;
    const gray = (level, alpha) => [level, level, level, alpha];
    const cases = {
        'RGBA 8-bit': {color: 6, depth: 8, samples: (x, y) => [0, 1, 2, 3].map((c) => value(x, y, c)), rgba: (x, y) => [0, 1, 2, 3].map((c) => value(x, y, c))},
        'RGBA 16-bit': {color: 6, depth: 16, samples: (x, y) => [0, 1, 2, 3].map((c) => value(x, y, c) * 256 + value(y, x, c)), rgba: (x, y) => [0, 1, 2, 3].map((c) => value(x, y, c))},
        'RGB 16-bit with a colour key': {color: 2, depth: 16, transparency: words(keyed(0, 0)), samples: keyed, rgba: (x, y) => [value(x, y, 0), value(x, y, 1), 0, opaqueUnlessKey(x, y)]},
        'palette 2-bit with alpha': {color: 3, depth: 2, palette: palette.flat(), transparency: [0, 128], samples: (x, y) => [index(x, y)], rgba: (x, y) => [...palette[index(x, y)], [0, 128][index(x, y)] ?? 255]},
        'gray 1-bit': {color: 0, depth: 1, samples: (x, y) => [(x ^ y) & 1], rgba: (x, y) => gray(((x ^ y) & 1) * 255, 255)},
        'gray 4-bit with a key': {color: 0, depth: 4, transparency: words([5]), samples: (x, y) => [(x + y) % 16], rgba: (x, y) => gray(((x + y) % 16) * 17, (x + y) % 16 === 5 ? 0 : 255)},
        'gray and alpha 8-bit': {color: 4, depth: 8, samples: (x, y) => [value(x, y, 0), value(x, y, 3)], rgba: (x, y) => gray(value(x, y, 0), value(x, y, 3))},
    };
    for (const interlace of [false, true]) {
        for (const [label, {rgba, ...format}] of Object.entries(cases)) {
            const image = decodePng(encodePng({width, height, interlace, ...format}));
            const expected = [];
            for (let y = 0; y < height; y += 1) for (let x = 0; x < width; x += 1) expected.push(...rgba(x, y));
            assert.deepEqual([image.width, image.height], [width, height], label);
            assert.deepEqual([...image.pixels], expected, `${label}${interlace ? ', interlaced' : ''}`);
        }
    }
    const layers = decodeIco(encodeIco([{size: 16, data: solidPng(16, 16, [1, 2, 3, 255])}, {size: 32, data: solidPng(32, 32, [4, 5, 6, 128])}]));
    assert.deepEqual(layers.map((layer) => [layer.width, layer.height, ...layer.pixels.subarray(0, 4)]), [[16, 16, 1, 2, 3, 255], [32, 32, 4, 5, 6, 128]]);
    assert.throws(() => decodeIco(encodeIco([{size: 16, data: Buffer.alloc(40)}])), /ICO layer 1 is a bitmap/);
    assert.throws(() => decodePng(Buffer.from('not a png')), /not a PNG image/);
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
