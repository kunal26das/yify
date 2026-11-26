import {createHash} from 'node:crypto';
import {existsSync, mkdirSync, readFileSync, writeFileSync} from 'node:fs';
import {dirname, join, resolve} from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';
import subsetFont from 'subset-font';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const REPOSITORY = 'google/material-design-icons';
const COMMIT = '10ecc14790612ca8fd164e3f4ffe9c16fc50d5b7';
const FONT = {path: 'variablefont/MaterialSymbolsRounded[FILL,GRAD,opsz,wght].ttf', sha1: 'ff99804f914a1db645bcf066dafa9449d9196f8d'};
const CODEPOINTS = {path: 'variablefont/MaterialSymbolsRounded[FILL,GRAD,opsz,wght].codepoints', sha1: '00d0111f220582144a76a352fd62d62b7e421e70'};
const AXES = {GRAD: 0, opsz: 24, wght: 400};
const LOCK_FILE = join(ROOT, 'scripts/icons/svg-sources.json');
const OUTPUT = join(ROOT, 'src/core/ui/icons');
const CACHE = join(ROOT, 'node_modules/.cache/yify-icons', COMMIT);
const SVG_PATH = /^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg" height="24" viewBox="0 -960 960 960" width="24"><path d="([^"]+)"\/><\/svg>\s*$/;

function gitBlobSha1(buffer) {
  return createHash('sha1').update(`blob ${buffer.length}\0`).update(buffer).digest('hex');
}

function rawUrl(path) {
  return `https://raw.githubusercontent.com/${REPOSITORY}/${COMMIT}/${path.split('/').map(encodeURIComponent).join('/')}`;
}

async function download(path, sha1) {
  const cached = join(CACHE, path);
  if (existsSync(cached)) {
    const buffer = readFileSync(cached);
    if (gitBlobSha1(buffer) === sha1) return buffer;
  }
  const response = await fetch(rawUrl(path));
  if (!response.ok) throw new Error(`${path}: HTTP ${response.status}`);
  const buffer = Buffer.from(await response.arrayBuffer());
  const actual = gitBlobSha1(buffer);
  if (actual !== sha1) throw new Error(`${path}: git blob SHA-1 ${actual} does not match the pinned ${sha1}`);
  mkdirSync(dirname(cached), {recursive: true});
  writeFileSync(cached, buffer);
  return buffer;
}

function svgFile(name, filled) {
  return `symbols/web/${name}/materialsymbolsrounded/${name}${filled ? '_fill1' : ''}_24px.svg`;
}

function wantedSvgs(names, filledNames) {
  return [...names.map((name) => svgFile(name, false)), ...filledNames.map((name) => svgFile(name, true))];
}

async function githubBlobShas(directory) {
  const headers = {Accept: 'application/vnd.github+json'};
  if (process.env.GITHUB_TOKEN) headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  const url = `https://api.github.com/repos/${REPOSITORY}/contents/${directory}?ref=${COMMIT}`;
  const response = await fetch(url, {headers});
  if (!response.ok) throw new Error(`${directory}: GitHub API HTTP ${response.status}`);
  const entries = await response.json();
  return new Map(entries.map((entry) => [`${directory}/${entry.name}`, entry.sha]));
}

async function writeLock(files) {
  const directories = [...new Set(files.map((file) => dirname(file)))];
  const shas = new Map();
  for (const directory of directories) {
    for (const [file, sha] of await githubBlobShas(directory)) shas.set(file, sha);
  }
  const lock = {repository: REPOSITORY, commit: COMMIT, files: {}};
  for (const file of files) {
    const sha = shas.get(file);
    if (!sha) throw new Error(`${file} does not exist at ${COMMIT}`);
    lock.files[file] = sha;
  }
  writeFileSync(LOCK_FILE, `${JSON.stringify(lock, null, 2)}\n`);
  return lock;
}

function readLock() {
  if (!existsSync(LOCK_FILE)) throw new Error('scripts/icons/svg-sources.json is missing. Run with --lock to record the SVG blob SHA-1s from GitHub.');
  const lock = JSON.parse(readFileSync(LOCK_FILE, 'utf8'));
  if (lock.commit !== COMMIT) throw new Error(`svg-sources.json records ${lock.commit}, expected ${COMMIT}. Run with --lock.`);
  return lock;
}

function parseCodepoints(text) {
  const map = new Map();
  for (const line of text.split('\n')) {
    const [name, hex] = line.trim().split(/\s+/);
    if (name && hex && !map.has(name)) map.set(name, Number.parseInt(hex, 16));
  }
  return map;
}

function svgPath(file, buffer) {
  const match = SVG_PATH.exec(buffer.toString('utf8'));
  if (!match) throw new Error(`${file}: expected one <path> in viewBox 0 -960 960 960`);
  return match[1];
}

async function instance(font, codepoints, fill) {
  const text = String.fromCodePoint(...codepoints);
  return subsetFont(font, text, {
    targetFormat: 'truetype',
    variationAxes: {FILL: fill, ...AXES},
    keepFeatures: [],
    noLayoutClosure: true,
  });
}

function glyphPathsSource(names, filledNames, paths) {
  const filled = new Set(filledNames);
  const lines = names.map((name) => {
    const outline = JSON.stringify(paths.get(svgFile(name, false))).replaceAll('"', "'");
    if (!filled.has(name)) return `  ${name}: {outline: ${outline}},`;
    const fill = JSON.stringify(paths.get(svgFile(name, true))).replaceAll('"', "'");
    return `  ${name}: {outline: ${outline}, filled: ${fill}},`;
  });
  return [
    "import type {IconName} from './glyphs';",
    '',
    'export interface GlyphPath {',
    '  outline: string;',
    '  filled?: string;',
    '}',
    '',
    'export const GLYPH_PATHS: Readonly<Record<IconName, GlyphPath>> = {',
    ...lines,
    '};',
    '',
  ].join('\n');
}

async function main() {
  const {ICON_NAMES, FILLED_ICON_NAMES} = await import(pathToFileURL(join(OUTPUT, 'glyphs.ts')).href);
  const files = wantedSvgs(ICON_NAMES, FILLED_ICON_NAMES);
  const lock = process.argv.includes('--lock') ? await writeLock(files) : readLock();
  const [font, codepointText] = await Promise.all([download(FONT.path, FONT.sha1), download(CODEPOINTS.path, CODEPOINTS.sha1)]);
  const codepoints = parseCodepoints(codepointText.toString('utf8'));
  const missing = ICON_NAMES.filter((name) => !codepoints.has(name));
  if (missing.length > 0) throw new Error(`Not in the pinned codepoints file: ${missing.join(', ')}`);
  const paths = new Map();
  for (const file of files) {
    const sha1 = lock.files[file];
    if (!sha1) throw new Error(`${file} has no recorded SHA-1. Run with --lock.`);
    paths.set(file, svgPath(file, await download(file, sha1)));
  }
  const outline = await instance(font, ICON_NAMES.map((name) => codepoints.get(name)), 0);
  const filled = await instance(font, FILLED_ICON_NAMES.map((name) => codepoints.get(name)), 1);
  const glyphMap = Object.fromEntries(ICON_NAMES.map((name) => [name, codepoints.get(name)]));
  writeFileSync(join(OUTPUT, 'YifyIcons.ttf'), outline);
  writeFileSync(join(OUTPUT, 'YifyIconsFilled.ttf'), filled);
  writeFileSync(join(OUTPUT, 'glyphMap.json'), `${JSON.stringify(glyphMap, null, 2)}\n`);
  writeFileSync(join(OUTPUT, 'glyphPaths.web.ts'), glyphPathsSource(ICON_NAMES, FILLED_ICON_NAMES, paths));
  console.log(`Icons: ${ICON_NAMES.length} glyphs (${FILLED_ICON_NAMES.length} filled) from ${REPOSITORY}@${COMMIT.slice(0, 12)}; YifyIcons.ttf ${outline.length} B, YifyIconsFilled.ttf ${filled.length} B.`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
