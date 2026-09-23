import {spawnSync} from 'node:child_process';
import {readFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {dirname, join, resolve} from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';
import {checkPins} from './check-dependency-pins.mjs';

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const dependencyCheck = 'Check that packages match versions required by installed Expo SDK';
const structuralChecks = new Set([
    'Check Expo config for common issues',
    'Check for app config fields that may not be synced in a non-CNG project',
]);

export async function verifyInstalledDependencies(pkg, root) {
    checkPins(pkg, 'package.json');
    for (const [name, expected] of Object.entries({...pkg.dependencies, ...pkg.devDependencies})) {
        let installed;
        try {
            installed = JSON.parse(await readFile(join(root, 'node_modules', name, 'package.json'), 'utf8')).version;
        } catch {
            throw new Error(`Cannot read installed dependency ${name}; install the committed dependency tree before checking Expo.`);
        }
        if (installed !== expected) throw new Error(`Installed ${name}@${installed} does not match package.json (${expected}); reinstall before checking Expo.`);
    }
}

export function reviewDeviations(dependencies, policy, sdkVersion) {
    if (policy.sdkVersion !== sdkVersion) throw new Error('Review Expo dependency deviations for the installed SDK.');
    return dependencies.map((dependency) => {
        const {packageName, actualVersion, expectedVersionOrRange} = dependency;
        const approved = policy.packages[packageName];
        if (!approved || approved.version !== actualVersion || approved.expected !== expectedVersionOrRange || !approved.reason?.trim()) {
            throw new Error(`Unreviewed Expo dependency: ${packageName}@${actualVersion}; expected ${expectedVersionOrRange}.`);
        }
        return `${packageName}@${actualVersion}; Expo recommends ${expectedVersionOrRange}. ${approved.reason}`;
    });
}

export function readDependencyCheck(run) {
    if (run.error || run.signal || ![0, 1].includes(run.status)) throw new Error('Expo dependency check could not finish successfully.');
    const output = (run.stdout ?? '').trim();
    const start = output.indexOf('{');
    let result;
    try { result = JSON.parse(output.slice(start)); } catch { throw new Error('Expo dependency check did not return valid JSON.'); }
    if (!Array.isArray(result.dependencies) || typeof result.upToDate !== 'boolean' ||
        result.upToDate !== (result.dependencies.length === 0) || (run.status === 0) !== result.upToDate ||
        result.dependencies.some((dependency) => !['packageName', 'actualVersion', 'expectedVersionOrRange'].every((key) => typeof dependency[key] === 'string' && dependency[key]))) {
        throw new Error('Expo dependency check returned inconsistent results.');
    }
    return result.dependencies;
}

export function assessDoctor(run, {reviewedDependencies = []} = {}) {
    if (run.error) throw new Error(`expo-doctor could not run: ${run.error.message}`);
    if (run.signal) throw new Error(`expo-doctor was terminated by ${run.signal}.`);
    if (![0, 1].includes(run.status)) throw new Error(`expo-doctor exited unexpectedly (${run.status}).`);
    const output = `${run.stdout ?? ''}${run.stderr ?? ''}`.replace(/\u001b\[[0-?]*[ -/]*[@-~]/g, '');
    const summary = output.match(/(\d+)\/(\d+) checks passed/);
    if (!summary || Number(summary[2]) === 0) throw new Error('expo-doctor did not produce a complete check summary.');
    const failures = [...new Set([...output.matchAll(/^✖ (.+)$/gm)].map((match) => match[1].trim()))];
    const failedCount = Number(summary[2]) - Number(summary[1]);
    if (failedCount !== failures.length || (run.status === 0) !== (failedCount === 0)) {
        throw new Error('expo-doctor exit status, summary and failure details disagree.');
    }
    const unexpected = failures.filter((name) => !structuralChecks.has(name) && !(name === dependencyCheck && reviewedDependencies.length > 0));
    if (unexpected.length) throw new Error(`expo-doctor reported unexpected failures: ${unexpected.join('; ')}`);
    if (failures.includes(dependencyCheck) !== (reviewedDependencies.length > 0)) {
        throw new Error('expo-doctor dependency findings differ from the reviewed dependency check.');
    }
    if (failures.includes(dependencyCheck)) {
        const escape = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const reportedCount = output.match(/(\d+) packages? out of date\./);
        if (Number(reportedCount?.[1]) !== reviewedDependencies.length || reviewedDependencies.some(({packageName, actualVersion, expectedVersionOrRange}) =>
            !new RegExp(`^${escape(packageName)}\\s+${escape(expectedVersionOrRange)}\\s+${escape(actualVersion)}\\s*$`, 'm').test(output))) {
            throw new Error('expo-doctor dependency findings differ from the reviewed dependency check.');
        }
    }
    return failures;
}

export async function main({root = projectRoot, spawn = spawnSync, log = console.log} = {}) {
    const require = createRequire(join(root, 'package.json'));
    const pkg = JSON.parse(await readFile(join(root, 'package.json'), 'utf8'));
    if (pkg.expo?.install?.exclude?.length) throw new Error('Use the reviewed Expo dependency policy instead of expo.install.exclude.');
    await verifyInstalledDependencies(pkg, root);
    const expo = require('expo/package.json');
    const sdkVersion = `${expo.version.split('.')[0]}.0.0`;
    const policy = JSON.parse(await readFile(join(root, 'scripts/expo-dependency-policy.json'), 'utf8'));
    const env = {...process.env, CI: '1', EXPO_NO_TELEMETRY: '1', FORCE_COLOR: '0'};
    for (const name of ['EXPO_OFFLINE', 'EXPO_NO_DEPENDENCY_VALIDATION', 'EXPO_DOCTOR_SKIP_DEPENDENCY_VERSION_CHECK', 'EXPO_DOCTOR_WARN_ON_NETWORK_ERRORS']) delete env[name];
    const options = {cwd: root, encoding: 'utf8', env, timeout: 120_000, maxBuffer: 10 * 1024 * 1024};
    const cli = join(dirname(require.resolve('expo/package.json')), 'bin/cli');
    const dependencyRun = spawn(process.execPath, [cli, 'install', '--check', '--json'], options);
    const dependencies = readDependencyCheck(dependencyRun);
    const reviewed = reviewDeviations(dependencies, policy, sdkVersion);
    for (const message of reviewed) log(`Reviewed Expo deviation: ${message}`);
    const doctor = require.resolve('expo-doctor/bin/expo-doctor.js');
    const run = spawn(process.execPath, [doctor], options);
    log(`${run.stdout ?? ''}${run.stderr ?? ''}`);
    const tolerated = assessDoctor(run, {reviewedDependencies: dependencies});
    if (tolerated.length) log(`Reviewed check deviations: ${tolerated.join('; ')}`);
    log('Expo checks passed with the reviewed deviations listed above.');
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
    main().catch((error) => { console.error(error.message); process.exitCode = 1; });
}
