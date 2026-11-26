import {execFileSync} from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

export const NATIVE_PATHS = ['yarn.lock', 'app.json', 'app.config.js', 'plugins', 'patches'];
export const NATIVE_PACKAGE_SECTIONS = ['dependencies', 'devDependencies', 'resolutions', 'workspaces', 'expo'];

function git(cwd, args) {
    return execFileSync('git', args, {cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe']});
}

function lines(output) {
    return output.split('\n').map((line) => line.trim()).filter(Boolean);
}

function canonical(value) {
    if (Array.isArray(value)) return value.map(canonical);
    if (value && typeof value === 'object') {
        return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonical(value[key])]));
    }
    return value;
}

function same(left, right) {
    return JSON.stringify(canonical(left)) === JSON.stringify(canonical(right));
}

export function releaseTag(version) {
    return `android-v${version}`;
}

export function checkOtaCompat({cwd = projectRoot} = {}) {
    const pkg = JSON.parse(fs.readFileSync(path.join(cwd, 'package.json'), 'utf8'));
    if (typeof pkg.version !== 'string' || pkg.version === '') throw new Error('package.json has no version.');
    const tag = releaseTag(pkg.version);
    try {
        git(cwd, ['rev-parse', '--verify', '--quiet', `refs/tags/${tag}^{commit}`]);
    } catch {
        return {ok: false, version: pkg.version, tag, differences: [], missingTag: true};
    }
    const paths = [...NATIVE_PATHS];
    if (lines(git(cwd, ['ls-files', '--', 'android'])).length > 0) paths.push('android');
    const changed = lines(git(cwd, ['diff', '--name-only', tag, '--', ...paths]));
    const untracked = lines(git(cwd, ['ls-files', '--others', '--exclude-standard', '--', ...paths]));
    const released = JSON.parse(git(cwd, ['show', `${tag}:package.json`]));
    const sections = NATIVE_PACKAGE_SECTIONS.filter((section) => !same(released[section], pkg[section])).map((section) => `package.json ${section}`);
    const differences = [...new Set([...changed, ...untracked])].sort().concat(sections);
    return {ok: differences.length === 0, version: pkg.version, tag, differences, missingTag: false};
}

export function describe(result) {
    if (result.missingTag) {
        return [
            `No tag ${result.tag}: no store build of runtime ${result.version} is recorded, so an update could reach no binary or the wrong one.`,
            `Tag the commit of the accepted production build first (git tag ${result.tag} <sha> && git push origin ${result.tag}), or fetch tags with git fetch --tags.`,
        ].join('\n');
    }
    if (result.ok) return `OTA compatible with ${result.tag}: no native input changed.`;
    return [
        `Refusing to publish an update for runtime ${result.version}: native inputs changed since ${result.tag}.`,
        ...result.differences.map((difference) => `  ${difference}`),
        'Native changes need a new store build: bump version and versionCode in package.json.',
    ].join('\n');
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
    try {
        const result = checkOtaCompat();
        const message = describe(result);
        if (result.ok) {
            console.log(message);
        } else {
            console.error(message);
            process.exitCode = 1;
        }
    } catch (error) {
        console.error(error.message);
        process.exitCode = 1;
    }
}
