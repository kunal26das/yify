import {createHash} from 'node:crypto';
import {readFile, writeFile} from 'node:fs/promises';
import {dirname, join, resolve} from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const hash = source => createHash('sha256').update(source).digest('hex');

export function preparePatch(source, patch) {
    const digest = hash(source);
    if (digest === patch.after) return source;
    if (digest !== patch.before) {
        throw new Error(`Review the tooling compatibility patch for ${patch.package}/${patch.file}: source hash changed.`);
    }
    const parts = source.split(patch.find);
    if (parts.length - 1 !== patch.count) {
        throw new Error(`Tooling compatibility anchor count changed for ${patch.package}/${patch.file}.`);
    }
    const updated = parts.join(patch.replace);
    if (hash(updated) !== patch.after) {
        throw new Error(`Tooling compatibility output hash changed for ${patch.package}/${patch.file}.`);
    }
    return updated;
}

export async function applyToolingCompatibility(projectRoot = root) {
    const patches = JSON.parse(await readFile(join(projectRoot, 'tooling/compatibility-patches.json'), 'utf8'));
    const prepared = [];
    for (const patch of patches) {
        const directory = join(projectRoot, patch.package);
        const pkg = JSON.parse(await readFile(join(directory, 'package.json'), 'utf8'));
        if (pkg.version !== patch.version) {
            throw new Error(`Review tooling compatibility for ${pkg.name}: expected ${patch.version}, installed ${pkg.version}.`);
        }
        const filename = join(directory, patch.file);
        const source = await readFile(filename, 'utf8');
        const updated = preparePatch(source, patch);
        if (updated !== source) prepared.push({filename, updated});
    }
    for (const {filename, updated} of prepared) await writeFile(filename, updated);
    return prepared.length;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
    applyToolingCompatibility().then(count => {
        console.log(`Tooling compatibility verified; updated ${count} files.`);
    }).catch(error => {
        console.error(error.message);
        process.exitCode = 1;
    });
}
