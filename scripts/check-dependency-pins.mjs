import {readFile} from 'node:fs/promises';
import {dirname, join, resolve} from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const exactVersion = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/;

export function checkPins(pkg, filename) {
    for (const section of ['dependencies', 'devDependencies', 'resolutions']) {
        for (const [name, version] of Object.entries(pkg[section] ?? {})) {
            if (!exactVersion.test(version)) throw new Error(`${filename}: ${section}.${name} must use an exact version, received ${version}.`);
        }
    }
}

export async function main() {
    for (const filename of ['package.json', 'crashreporting/package.json', 'release/package.json']) {
        checkPins(JSON.parse(await readFile(join(root, filename), 'utf8')), filename);
    }
    console.log('Application, crash-reporting workspace and release-console dependencies use exact versions.');
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
    main().catch((error) => { console.error(error.message); process.exitCode = 1; });
}
