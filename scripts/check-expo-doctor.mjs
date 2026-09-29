import {spawnSync} from 'node:child_process';
import {readFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {dirname, join, resolve} from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';
import {checkPins} from './check-dependency-pins.mjs';

const require = createRequire(import.meta.url);
const semver = createRequire(require.resolve('@expo/cli/package.json'))('semver');
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

function recommendation(value) {
    const match = typeof value === 'string' && value.match(/^([~^]?)(\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?)$/);
    const version = match && semver.parse(match[2]);
    return version ? {operator: match[1], version} : null;
}

function isBundledRecommendationUpdate(actualVersion, expected, bundled, reviewedExpected) {
    const actual = semver.parse(actualVersion);
    const next = recommendation(expected);
    const baseline = recommendation(bundled);
    const reviewed = recommendation(reviewedExpected ?? bundled);
    if (!actual || !next || !baseline || !reviewed) return false;
    if (actualVersion === bundled && next.operator === baseline.operator &&
        isPrereleaseRecommendationUpdate(actualVersion, expected, reviewedExpected ?? bundled)) return true;
    if (!semver.satisfies(actual, bundled)) return false;
    return [actual, baseline.version, reviewed.version, next.version].every((version) =>
        version.prerelease.length === 0 && version.major === actual.major && version.minor === actual.minor) &&
        next.operator === baseline.operator && next.operator === reviewed.operator &&
        semver.gt(next.version, actual) && semver.gt(next.version, baseline.version) && semver.gt(next.version, reviewed.version);
}

function isPrereleaseRecommendationUpdate(actualVersion, expected, reviewedExpected) {
    const actual = recommendation(actualVersion);
    const next = recommendation(expected);
    const reviewed = recommendation(reviewedExpected);
    if (!actual || !next || !reviewed || next.operator !== reviewed.operator) return false;
    const versions = [actual.version, reviewed.version, next.version];
    return versions.every((version) =>
        version.major === actual.version.major && version.minor === actual.version.minor && version.patch === actual.version.patch &&
        version.prerelease.length === 2 && typeof version.prerelease[0] === 'string' && typeof version.prerelease[1] === 'number' &&
        version.prerelease[0] === actual.version.prerelease[0]) &&
        semver.gte(reviewed.version, actual.version) && semver.gt(next.version, reviewed.version);
}

export function reviewDeviations(dependencies, policy, sdkVersion, installedSdk) {
    if (policy.sdkVersion !== sdkVersion) throw new Error('Review Expo dependency deviations for the installed SDK.');
    if (installedSdk) {
        const {expoVersion, installedVersions, bundledNativeModules} = installedSdk;
        const approvedExpo = policy.packages.expo;
        if (!semver.valid(expoVersion) || `${semver.major(expoVersion)}.0.0` !== sdkVersion ||
            approvedExpo?.version !== expoVersion || !approvedExpo.reason?.trim() ||
            !installedVersions || !bundledNativeModules || typeof bundledNativeModules !== 'object' || Array.isArray(bundledNativeModules)) {
            throw new Error('Review Expo dependency deviations for the installed SDK version.');
        }
        for (const [name, approved] of Object.entries(policy.packages)) {
            if (installedVersions[name] !== approved.version || !approved.reason?.trim()) {
                throw new Error(`Unreviewed installed Expo dependency: ${name}@${installedVersions[name]}; reviewed ${approved.version}.`);
            }
        }
    }
    return dependencies.map((dependency) => {
        const {packageName, actualVersion, expectedVersionOrRange} = dependency;
        const approved = policy.packages[packageName];
        const reject = () => {
            throw new Error(`Unreviewed Expo dependency: ${packageName}@${actualVersion}; expected ${expectedVersionOrRange}.`);
        };
        if (installedSdk && installedSdk.installedVersions[packageName] !== actualVersion) reject();
        if (approved && (approved.version !== actualVersion || !approved.reason?.trim())) reject();
        if (approved?.expected === expectedVersionOrRange) {
            return `${packageName}@${actualVersion}; Expo recommends ${expectedVersionOrRange}. ${approved.reason}`;
        }
        if (installedSdk) {
            const bundled = installedSdk.bundledNativeModules[packageName];
            if (packageName === 'expo' && approved && isPrereleaseRecommendationUpdate(actualVersion, expectedVersionOrRange, approved.expected)) {
                return `${packageName}@${actualVersion}; Expo now recommends ${expectedVersionOrRange} (reviewed ${approved.expected}). Schedule a coordinated SDK update. ${approved.reason}`;
            }
            if (packageName === 'react-native' && approved?.expected === bundled &&
                isPrereleaseRecommendationUpdate(bundled, actualVersion, bundled) &&
                isPrereleaseRecommendationUpdate(actualVersion, expectedVersionOrRange, actualVersion)) {
                return `${packageName}@${actualVersion} matches the reviewed native runtime; Expo now recommends ${expectedVersionOrRange}. Schedule a coordinated dependency update. ${approved.reason}`;
            }
            if (packageName !== 'expo' && isBundledRecommendationUpdate(actualVersion, expectedVersionOrRange, bundled, approved?.expected)) {
                return `${packageName}@${actualVersion} satisfies bundled ${bundled} from Expo ${installedSdk.expoVersion}; Expo now recommends ${expectedVersionOrRange}. Schedule a coordinated dependency update.${approved ? ` ${approved.reason}` : ''}`;
            }
        }
        return reject();
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
    const displayedDependencies = reviewedDependencies.filter(({actualVersion, expectedVersionOrRange}) => {
        const version = /^[~^]?(\d+\.\d+\.\d+)(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/;
        const actualCore = actualVersion.match(version)?.[1];
        const expectedCore = expectedVersionOrRange.match(version)?.[1];
        return !actualCore || !expectedCore || actualCore !== expectedCore;
    });
    const unexpected = failures.filter((name) => !structuralChecks.has(name) && !(name === dependencyCheck && displayedDependencies.length > 0));
    if (unexpected.length) throw new Error(`expo-doctor reported unexpected failures: ${unexpected.join('; ')}`);
    if (failures.includes(dependencyCheck) !== (displayedDependencies.length > 0)) {
        throw new Error('expo-doctor dependency findings differ from the reviewed dependency check.');
    }
    if (failures.includes(dependencyCheck)) {
        const escape = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const reportedCount = output.match(/(\d+) packages? out of date\./);
        if (Number(reportedCount?.[1]) !== displayedDependencies.length || displayedDependencies.some(({packageName, actualVersion, expectedVersionOrRange}) =>
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
    const bundledNativeModules = JSON.parse(await readFile(join(dirname(require.resolve('expo/package.json')), 'bundledNativeModules.json'), 'utf8'));
    const env = {...process.env, CI: '1', EXPO_NO_TELEMETRY: '1', FORCE_COLOR: '0'};
    for (const name of ['EXPO_OFFLINE', 'EXPO_NO_DEPENDENCY_VALIDATION', 'EXPO_DOCTOR_SKIP_DEPENDENCY_VERSION_CHECK', 'EXPO_DOCTOR_WARN_ON_NETWORK_ERRORS']) delete env[name];
    const options = {cwd: root, encoding: 'utf8', env, timeout: 120_000, maxBuffer: 10 * 1024 * 1024};
    const cli = join(dirname(require.resolve('expo/package.json')), 'bin/cli');
    const dependencyRun = spawn(process.execPath, [cli, 'install', '--check', '--json'], options);
    const dependencies = readDependencyCheck(dependencyRun);
    const reviewed = reviewDeviations(dependencies, policy, sdkVersion, {
        expoVersion: expo.version,
        installedVersions: {...pkg.dependencies, ...pkg.devDependencies},
        bundledNativeModules,
    });
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
