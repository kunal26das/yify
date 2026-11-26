import {readdir, readFile, stat, writeFile} from 'node:fs/promises';
import {dirname, extname, join, relative, resolve} from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';

const repository = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
export const BANNED_HEX = ['#D97757', '#9C452B', '#F3F0E9'];
const RELEASE_SCAN = ['config', 'src', 'public', 'app.json'];
const TEXT_EXTENSIONS = new Set(['.cjs', '.css', '.html', '.js', '.json', '.md', '.mjs', '.svg', '.ts', '.tsx', '.txt', '.webmanifest', '.xml']);
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

export async function compareIcons(iconsDirectory, root = repository) {
    const source = resolve(iconsDirectory);
    const differences = [];
    for (const file of await walk(source, () => true)) {
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
    problems.push(...await findBannedColors(root));
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
    if (options.requireFinal || options.icons) problems.push(...await checkRelease({icons: options.icons}));
    if (problems.length) {
        for (const problem of problems) console.error(problem);
        process.exitCode = 1;
        return;
    }
    if (options.check) console.log(`Brand files match config/brand.json (${brand.appName}, ${brand.status}).`);
    else console.log(stale.length ? `Stamped ${stale.join(', ')} from config/brand.json.` : 'Brand files already match config/brand.json.');
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
    main(process.argv.slice(2)).catch((error) => {
        console.error(error.message);
        process.exitCode = 1;
    });
}
