import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repository = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

export const sha256 = (value) => createHash('sha256').update(value).digest('hex');

export function applyUnifiedPatch(source, patch) {
  const original = source.split('\n');
  if (original.at(-1) === '') original.pop();
  const lines = patch.split('\n');
  if (!lines[0]?.startsWith('--- ') || !lines[1]?.startsWith('+++ ')) {
    throw new Error('Invalid compatibility patch headers');
  }
  const output = [];
  let position = 0;
  let hunks = 0;
  for (let index = 2; index < lines.length;) {
    if (index === lines.length - 1 && lines[index] === '') break;
    const header = /^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@(?:.*)$/.exec(lines[index++]);
    if (!header) throw new Error('Invalid compatibility patch hunk');
    const start = Number(header[1]) === 0 ? 0 : Number(header[1]) - 1;
    if (start < position || start > original.length) throw new Error('Invalid compatibility patch position');
    output.push(...original.slice(position, start));
    position = start;
    let removed = 0;
    let added = 0;
    while (index < lines.length && !lines[index].startsWith('@@ ')) {
      const line = lines[index++];
      if (index === lines.length && line === '') break;
      const operation = line[0];
      const value = line.slice(1);
      if (operation !== '+' && operation !== '-' && operation !== ' ') throw new Error('Invalid compatibility patch operation');
      if (operation !== '+') {
        if (original[position++] !== value) throw new Error('Compatibility patch context does not match');
        removed += 1;
      }
      if (operation !== '-') {
        output.push(value);
        added += 1;
      }
    }
    if (removed !== Number(header[2] ?? 1) || added !== Number(header[4] ?? 1)) {
      throw new Error('Compatibility patch line count does not match');
    }
    hunks += 1;
  }
  if (hunks === 0) throw new Error('Empty compatibility patch');
  output.push(...original.slice(position));
  return output.join('\n') + (source.endsWith('\n') ? '\n' : '');
}

function safePath(root, relative) {
  if (!relative || path.isAbsolute(relative) || relative.includes('\\') || relative.split('/').some((part) => part === '..' || part === '.')) {
    throw new Error(`Invalid compatibility path: ${relative}`);
  }
  return path.join(root, relative);
}

export async function applyCompatibility({ root = repository, patchDirectory = path.join(repository, 'patches/expo-rn87'), check = false } = {}) {
  const manifest = JSON.parse(await readFile(path.join(patchDirectory, 'manifest.json'), 'utf8'));
  const rn = JSON.parse(await readFile(path.join(root, 'node_modules/react-native/package.json'), 'utf8'));
  if (rn.version !== manifest.reactNative) throw new Error(`Expo compatibility requires react-native@${manifest.reactNative}; installed ${rn.version}`);
  const pending = [];
  const seen = new Set();
  const versions = new Map();
  for (const entry of manifest.files) {
    const packageDirectory = safePath(path.join(root, 'node_modules'), entry.package);
    if (!versions.has(entry.package)) {
      versions.set(entry.package, JSON.parse(await readFile(path.join(packageDirectory, 'package.json'), 'utf8')).version);
    }
    if (versions.get(entry.package) !== entry.version) throw new Error(`Expo compatibility requires ${entry.package}@${entry.version}; installed ${versions.get(entry.package)}`);
    const target = safePath(packageDirectory, entry.file);
    if (seen.has(target)) throw new Error(`Duplicate compatibility target: ${entry.package}/${entry.file}`);
    seen.add(target);
    const original = await readFile(target, 'utf8');
    const digest = sha256(original);
    if (digest === entry.after) continue;
    if (digest !== entry.before) throw new Error(`Unrecognized compatibility source: ${entry.package}/${entry.file}`);
    const patch = await readFile(safePath(patchDirectory, entry.patch), 'utf8');
    const patched = applyUnifiedPatch(original, patch);
    if (sha256(patched) !== entry.after) throw new Error(`Compatibility patch digest does not match: ${entry.package}/${entry.file}`);
    pending.push({ target, patched });
  }
  if (check && pending.length) throw new Error(`${pending.length} Expo compatibility patches have not been applied`);
  for (const { target, patched } of pending) await writeFile(target, patched);
  return { applied: pending.length, verified: manifest.files.length, reactNative: rn.version };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const result = await applyCompatibility({ check: process.argv.includes('--check') });
    console.log(`Expo RN ${result.reactNative} compatibility: ${result.applied} applied, ${result.verified} verified.`);
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
