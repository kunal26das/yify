import {readdir, readFile, stat, writeFile} from 'node:fs/promises';
import {basename, dirname, extname, join, relative, resolve} from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';
import {decodeIco, decodePng} from './raster.mjs';

const repository = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
export const BANNED_HEX = ['#D97757', '#9C452B', '#F3F0E9'];
export const BANNED_PIXEL_TOLERANCE = 8;
export const BANNED_PIXEL_SHARE = 0.01;
const BANNED_RGB = BANNED_HEX.map((hex) => [1, 3, 5].map((start) => Number.parseInt(hex.slice(start, start + 2), 16)));
const RELEASE_SCAN = ['config', 'src', 'public', 'assets', 'app.json'];
const RASTER_SCAN = ['public', 'assets'];
const TEXT_EXTENSIONS = new Set(['.cjs', '.css', '.html', '.js', '.json', '.md', '.mjs', '.svg', '.ts', '.tsx', '.txt', '.webmanifest', '.xml']);
const RASTER_EXTENSIONS = new Set(['.avif', '.bmp', '.gif', '.heic', '.ico', '.jpeg', '.jpg', '.png', '.tif', '.tiff', '.webp']);
const IGNORED_FILES = new Set(['.DS_Store']);
const USAGE = 'usage: node scripts/brand/stamp-public.mjs [--check] [--require-final] [--icons <directory>]';

export function escapeHtml(value) {
    return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

export function renderBrandCss(brand) {
    const declarations = (colors, indent) => Object.entries(colors).map(([role, value]) => `${indent}--c-${role}: ${value};`).join('\n');
    return [
        ':root {',
        '  color-scheme: light dark;',
        declarations(brand.colors.light, '  '),
        '}',
        '',
        '@media (prefers-color-scheme: dark) {',
        '  :root {',
        declarations(brand.colors.dark, '    '),
        '  }',
        '}',
        '',
    ].join('\n');
}

export function stampManifest(manifest, brand) {
    return {
        ...manifest,
        name: brand.appName,
        short_name: brand.appName,
        background_color: brand.colors.dark.surface,
        theme_color: brand.colors.dark.surface,
    };
}

export function stampHtml(html, appName) {
    if (!/<span class="app-name">/.test(html)) return html;
    const name = escapeHtml(appName);
    return html
        .replace(/(<span class="app-name">)[^<]*(<\/span>)/g, `$1${name}$2`)
        .replace(/(<title>[^<]*(?: · | &middot; ))[^<]*(<\/title>)/, `$1${name}$2`);
}

async function walk(directory, accept) {
    const entries = await readdir(directory, {withFileTypes: true}).catch((error) => {
        if (error.code === 'ENOENT') return [];
        throw error;
    });
    const files = [];
    for (const entry of entries) {
        const path = join(directory, entry.name);
        if (entry.isDirectory()) files.push(...await walk(path, accept));
        else if (entry.isFile() && accept(path)) files.push(path);
    }
    return files.sort();
}

async function readText(file) {
    try {
        return await readFile(file, 'utf8');
    } catch (error) {
        if (error.code === 'ENOENT') return null;
        throw error;
    }
}

export async function readBrand(root = repository) {
    return JSON.parse(await readFile(join(root, 'config/brand.json'), 'utf8'));
}

export async function stampPublic({root = repository, check = false} = {}) {
    const brand = await readBrand(root);
    const manifestPath = join(root, 'public/manifest.json');
    const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
    const outputs = [
        [manifestPath, `${JSON.stringify(stampManifest(manifest, brand), null, 2)}\n`],
        [join(root, 'public/brand.css'), renderBrandCss(brand)],
    ];
    for (const file of await walk(join(root, 'public'), (path) => extname(path) === '.html')) {
        outputs.push([file, stampHtml(await readFile(file, 'utf8'), brand.appName)]);
    }
    const stale = [];
    for (const [file, expected] of outputs) {
        if (await readText(file) === expected) continue;
        stale.push(relative(root, file));
        if (!check) await writeFile(file, expected);
    }
    return {brand, stale};
}

export async function findBannedColors(root = repository) {
    const banned = new RegExp(`(?:${BANNED_HEX.join('|')})(?![0-9a-f])`, 'i');
    const findings = [];
    for (const entry of RELEASE_SCAN) {
        const path = join(root, entry);
        const info = await stat(path).catch(() => null);
        if (!info) continue;
        const files = info.isDirectory() ? await walk(path, (file) => TEXT_EXTENSIONS.has(extname(file))) : [path];
        for (const file of files) {
            (await readFile(file, 'utf8')).split('\n').forEach((line, index) => {
                const match = line.match(banned);
                if (match) findings.push(`${relative(root, file)}:${index + 1} uses the banned colour ${match[0]}`);
            });
        }
    }
    return findings;
}

export function bannedPixels({pixels}) {
    const counts = BANNED_RGB.map(() => 0);
    let opaque = 0;
    for (let offset = 0; offset < pixels.length; offset += 4) {
        if (pixels[offset + 3] < 128) continue;
        opaque += 1;
        const match = BANNED_RGB.findIndex(([red, green, blue]) => Math.abs(pixels[offset] - red) <= BANNED_PIXEL_TOLERANCE
            && Math.abs(pixels[offset + 1] - green) <= BANNED_PIXEL_TOLERANCE && Math.abs(pixels[offset + 2] - blue) <= BANNED_PIXEL_TOLERANCE);
        if (match >= 0) counts[match] += 1;
    }
    return {opaque, counts};
}

function describeBannedPixels(image) {
    const {opaque, counts} = bannedPixels(image);
    const total = counts.reduce((sum, count) => sum + count, 0);
    if (!opaque || total / opaque < BANNED_PIXEL_SHARE) return null;
    const worst = BANNED_HEX[counts.indexOf(Math.max(...counts))];
    return `${((100 * total) / opaque).toFixed(1)}% of its opaque pixels are within ${BANNED_PIXEL_TOLERANCE} of a banned colour, mostly ${worst}`;
}

export async function findBannedRasterColors(root = repository) {
    const findings = [];
    for (const entry of RASTER_SCAN) {
        for (const file of await walk(join(root, entry), (path) => RASTER_EXTENSIONS.has(extname(path).toLowerCase()))) {
            const name = relative(root, file);
            const extension = extname(file).toLowerCase();
            let images;
            try {
                if (extension !== '.png' && extension !== '.ico') throw new Error('check:release reads PNG and ICO images only; save it as PNG');
                const buffer = await readFile(file);
                images = extension === '.ico' ? decodeIco(buffer) : [decodePng(buffer)];
            } catch (error) {
                findings.push(`${name} cannot be checked for banned colours: ${error.message}.`);
                continue;
            }
            for (const image of images) {
                const problem = describeBannedPixels(image);
                const layer = extension === '.ico' ? ` (${image.width}x${image.height} layer)` : '';
                if (problem) findings.push(`${name}${layer}: ${problem}.`);
            }
        }
    }
    return findings;
}

async function mirrorFiles(source) {
    const info = await stat(source).catch(() => null);
    if (!info?.isDirectory()) return null;
    return walk(source, (file) => !IGNORED_FILES.has(basename(file)));
}

export async function compareIcons(iconsDirectory, root = repository) {
    const source = resolve(iconsDirectory);
    const files = await mirrorFiles(source);
    if (!files) return [`${iconsDirectory} is not a directory; --icons takes the identity's icon mirror laid out by repository path.`];
    if (!files.length) return [`${iconsDirectory} has no icon files to compare.`];
    const differences = [];
    for (const file of files) {
        const target = join(root, relative(source, file));
        const [expected, actual] = await Promise.all([readFile(file), readFile(target).catch(() => null)]);
        if (!actual) differences.push(`${relative(root, target)} is missing`);
        else if (!expected.equals(actual)) differences.push(`${relative(root, target)} differs from ${file}`);
    }
    return differences;
}

export async function checkRelease({root = repository, icons = null} = {}) {
    const brand = await readBrand(root);
    const problems = [];
    if (brand.status !== 'final') problems.push(`config/brand.json status is "${brand.status}"; the Identity step sets it to "final".`);
    problems.push(...await findBannedColors(root), ...await findBannedRasterColors(root));
    if (icons) problems.push(...await compareIcons(icons, root));
    return problems;
}

function parseArguments(args) {
    const options = {check: false, requireFinal: false, icons: null};
    for (let index = 0; index < args.length; index += 1) {
        if (args[index] === '--check') options.check = true;
        else if (args[index] === '--require-final') options.requireFinal = true;
        else if (args[index] === '--icons' && args[index + 1]) options.icons = args[++index];
        else throw new Error(USAGE);
    }
    return options;
}

async function main(args) {
    const options = parseArguments(args);
    const {brand, stale} = await stampPublic({check: options.check});
    const problems = options.check ? stale.map((file) => `${file} does not match config/brand.json; run yarn brand:stamp.`) : [];
    const release = options.requireFinal || Boolean(options.icons);
    if (release) problems.push(...await checkRelease({icons: options.icons}));
    if (problems.length) {
        for (const problem of problems) console.error(problem);
        process.exitCode = 1;
        return;
    }
    if (options.check) console.log(`Brand files match config/brand.json (${brand.appName}, ${brand.status}).`);
    else console.log(stale.length ? `Stamped ${stale.join(', ')} from config/brand.json.` : 'Brand files already match config/brand.json.');
    if (!release) return;
    const icons = options.icons
        ? `${(await mirrorFiles(resolve(options.icons))).length} icon files match ${options.icons}`
        : 'icons not compared (pass --icons <mirror>)';
    console.log(`Release checks passed: status final, no banned colours in text or images; ${icons}.`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
    main(process.argv.slice(2)).catch((error) => {
        console.error(error.message);
        process.exitCode = 1;
    });
}
