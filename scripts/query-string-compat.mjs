import {readFile, writeFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {dirname, join, resolve} from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';
import {preparePatch} from './apply-tooling-compatibility.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

export async function applyQueryStringCompatibility(projectRoot = root) {
    const patch = JSON.parse(await readFile(join(projectRoot, 'patches/query-string-compat.json'), 'utf8'));
    const directory = join(projectRoot, patch.package);
    const queryString = JSON.parse(await readFile(join(directory, 'package.json'), 'utf8'));
    const filename = join(directory, patch.file);
    const require = createRequire(filename);
    const decoderDirectory = dirname(require.resolve('decode-uri-component'));
    const decoder = JSON.parse(await readFile(join(decoderDirectory, 'package.json'), 'utf8'));
    if (queryString.version !== patch.version || decoder.version !== patch.decoderVersion) {
        throw new Error(`Review query-string compatibility: expected ${patch.version}/${patch.decoderVersion}, installed ${queryString.version}/${decoder.version}.`);
    }
    const source = await readFile(filename, 'utf8');
    const updated = preparePatch(source, patch);
    if (updated === source) return false;
    await writeFile(filename, updated);
    return true;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
    applyQueryStringCompatibility().then(changed => {
        console.log(`Query-string decoder compatibility verified; updated ${Number(changed)} files.`);
    }).catch(error => {
        console.error(error.message);
        process.exitCode = 1;
    });
}
