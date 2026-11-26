import {createHash} from 'node:crypto';
import {mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync} from 'node:fs';
import {dirname, join, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import subsetFont from 'subset-font';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const OUTPUT = join(ROOT, 'public/fonts');
const FACES = ['display', 'body', 'bodyStrong'];
const SOURCES = 'scripts/fonts/font-sources.json';

function readJson(path) {
  return JSON.parse(readFileSync(join(ROOT, path), 'utf8'));
}

export function verifiedSource(file, buffer, pinned) {
  const expected = pinned.sha256[file];
  if (!expected) throw new Error(`${file} has no pinned SHA-256 in ${SOURCES}. Record the hash of the reviewed font before building.`);
  const actual = createHash('sha256').update(buffer).digest('hex');
  if (actual !== expected) throw new Error(`${file}: SHA-256 ${actual} does not match the pinned ${expected} (${pinned.package} ${pinned.version}).`);
  return buffer;
}

export function subsetFileName(web, subset) {
  return web.replace(/\.woff2$/, `.${subset}.woff2`);
}

export function codepointsOf(unicodeRange) {
  const codepoints = new Set();
  for (const part of unicodeRange.split(',')) {
    const match = /^U\+([0-9A-F]+)(?:-([0-9A-F]+))?$/i.exec(part.trim());
    if (!match) throw new Error(`Invalid unicode-range part: ${part}`);
    const start = Number.parseInt(match[1], 16);
    const end = match[2] ? Number.parseInt(match[2], 16) : start;
    for (let codepoint = start; codepoint <= end; codepoint += 1) codepoints.add(codepoint);
  }
  return [...codepoints];
}

async function main() {
  const brand = readJson('config/brand.json');
  const {subsets} = readJson('src/core/ui/theme/fontSubsets.json');
  const pinned = readJson(SOURCES);
  const sources = new Map(FACES.map((face) => {
    const {file} = brand.fonts[face];
    return [face, verifiedSource(file, readFileSync(join(ROOT, file)), pinned)];
  }));
  mkdirSync(OUTPUT, {recursive: true});
  const expected = new Set();
  const lines = [];
  for (const face of FACES) {
    const font = brand.fonts[face];
    const source = sources.get(face);
    for (const subset of subsets) {
      const text = String.fromCodePoint(...codepointsOf(subset.unicodeRange));
      const woff2 = await subsetFont(source, text, {targetFormat: 'woff2'});
      const name = subsetFileName(font.web, subset.name);
      expected.add(name);
      writeFileSync(join(OUTPUT, name), woff2);
      const sha256 = createHash('sha256').update(woff2).digest('hex').slice(0, 12);
      lines.push(`${name} ${woff2.length} B ${sha256}`);
    }
  }
  for (const file of readdirSync(OUTPUT)) {
    if (file.endsWith('.woff2') && !expected.has(file)) rmSync(join(OUTPUT, file));
  }
  console.log(`Web fonts: ${lines.length} WOFF2 subsets in public/fonts\n${lines.join('\n')}`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
