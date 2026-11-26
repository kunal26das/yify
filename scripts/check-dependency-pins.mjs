import {readFile} from 'node:fs/promises';
import {dirname, join, resolve} from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';
import {applyCompatibility} from './expo-native-compat.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const exactVersion = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/;
const packageAlias = /^npm:(?:@[a-z0-9][a-z0-9._-]*\/)?[a-z0-9][a-z0-9._-]*@(.+)$/;
const manifests = ['package.json', 'tooling/package.json'];
const firebaseScope = '@react-native-firebase/';
const firebaseApp = `${firebaseScope}app`;

async function readJson(file) {
    return JSON.parse(await readFile(file, 'utf8'));
}

export function checkPins(pkg, filename) {
    for (const section of ['dependencies', 'devDependencies', 'resolutions']) {
        for (const [name, version] of Object.entries(pkg[section] ?? {})) {
            const aliasedVersion = typeof version === 'string' ? version.match(packageAlias)?.[1] : undefined;
            if (typeof version !== 'string' || version.trim() !== version || !exactVersion.test(aliasedVersion ?? version)) {
                throw new Error(`${filename}: ${section}.${name} must use an exact version, received ${version}.`);
            }
        }
    }
}

export async function checkFirebaseAlignment(projectRoot = root) {
    const pkg = await readJson(join(projectRoot, 'package.json'));
    const dependencies = pkg.dependencies ?? {};
    const modules = Object.keys(dependencies).filter((name) => name.startsWith(firebaseScope)).sort();
    if (!modules.includes(firebaseApp)) throw new Error(`package.json: dependencies must include ${firebaseApp}.`);
    const app = await readJson(join(projectRoot, 'node_modules', firebaseApp, 'package.json'));
    for (const name of modules) {
        const installed = (await readJson(join(projectRoot, 'node_modules', name, 'package.json'))).version;
        if (dependencies[name] !== dependencies[firebaseApp] || installed !== dependencies[name]) {
            throw new Error(`${name} ${installed} (declared ${dependencies[name]}) does not match ${firebaseApp} ${dependencies[firebaseApp]}.`);
        }
    }
    const expected = app.dependencies?.firebase;
    if (dependencies.firebase !== expected) {
        throw new Error(`Firebase JS SDK ${dependencies.firebase} does not match ${firebaseApp} ${app.version} (expects ${expected}).`);
    }
    return {version: app.version, firebase: expected, modules};
}

export async function main({manifestsOnly = false} = {}) {
    for (const filename of manifests) {
        checkPins(await readJson(join(root, filename)), filename);
    }
    if (manifestsOnly) {
        console.log('Application and tooling dependencies use exact versions.');
        return;
    }
    const firebase = await checkFirebaseAlignment(root);
    await applyCompatibility({check: true});
    console.log(`Application and tooling dependencies use exact versions; ${firebase.modules.length} React Native Firebase modules share ${firebase.version} with firebase ${firebase.firebase}; Expo native patches are applied.`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
    main({manifestsOnly: process.argv.includes('--manifests-only')}).catch((error) => { console.error(error.message); process.exitCode = 1; });
}
